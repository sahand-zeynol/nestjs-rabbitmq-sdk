import { Channel, ConfirmChannel, connect, Connection, Options } from "amqplib";
import { v4 as uuid } from "uuid";
import { CACHE_MANAGER, Inject, Injectable } from "@nestjs/common";
import { delay, isNil } from "./helpers";
import { IRMQOptions } from "./interfaces/rmq.service.options";
import { Cache } from "cache-manager";
import { IChannel, IExchange, IPublish, PublishOptions } from "./interfaces";

@Injectable()
export class RmqService {
  private connectionRetry: boolean;
  private consumerRetry: number;
  private connection: Connection;
  private configChannels: Record<string, IChannel>;
  private configExchanges: Record<string, IExchange>;
  private configConsumers: Record<string, IPublish>;
  private configPublishers: Record<string, IPublish>;
  private channels: Record<string, Channel | ConfirmChannel> = {};
  private handlers = {};

  /**
   * Constructor
   * @param options
   */
  constructor(
    private options: IRMQOptions,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {
    this.consumerRetry = options.consumerRetry;
    this.configChannels = options.channels;
    this.configExchanges = options.exchanges;
    this.configConsumers = options.consumers;
    this.configPublishers = options.publishers;
    this.connect();
  }

  /**
   * Connect
   * @param rabbitmqUrl
   */
  async connect(rabbitmqUrl: string = this.options.url) {
    try {
      if (this.connection) {
        return this.connection;
      }

      this.connection = await connect(rabbitmqUrl);
      this.connectionRetry = true;

      // On error
      this.connection.on("error", (error) => {
        if (error.message !== "Connection closing") {
          console.error("[AMQP] conn error =>", error.message);
        }
      });

      // On close
      this.connection.on("close", async () => {
        if (!this.connectionRetry) {
          return;
        }
        console.warn("[AMQP] reconnecting");
        await this.retryConnect();
      });

      // Initialize
      await this.init();
    } catch (error) {
      console.error("[AMQP] disconnected, retrying... =>", error.message);
      await this.retryConnect();
    }
  }

  /**
   * Close connection
   */
  async closeConnection() {
    if (!this.connection) {
      return true;
    }
    this.connectionRetry = false;
    const res = await this.connection.close();
    this.connection = null;
    this.channels = {};
    return res;
  }

  /**
   * Initialize
   */
  private async init() {
    try {
      await this.createChannels();
      // tslint:disable-next-line:forin
      for (const queue in this.configPublishers) {
        await this.channelAssertion(this.configPublishers[queue]);
      }
      // tslint:disable-next-line:forin
      for (const queue in this.configConsumers) {
        await this.channelAssertion(this.configConsumers[queue]);
        await this.consumer(this.configConsumers[queue]);
      }
    } catch (error) {
      console.error("Error while initializing =>", error.message);
      await this.closeConnection();
      throw new Error(error);
    }
  }

  /**
   * create all channels
   */
  private async createChannels() {
    for (const key in this.configChannels) {
      if (this.configChannels[key].type === "consumer") {
        this.channels[key] = await this.createChannel(key);
      } else if (this.configChannels[key].type === "publisher") {
        this.channels[key] = await this.createConfirmedChannel(key);
      }
    }
  }

  /**
   * Retry connect
   */
  private async retryConnect() {
    try {
      await delay(1000);
      await this.connect();
    } catch (error) {
      console.error("Error while retrying =>", error.message);
    }
  }

  /**
   * Create confirmed channel
   * @param channelName
   */
  private async createConfirmedChannel(channelName): Promise<ConfirmChannel> {
    try {
      if (this.channels[channelName]) {
        return this.channels[channelName] as ConfirmChannel;
      }

      const confirmedChannel = await this.connection.createConfirmChannel();

      // On error
      confirmedChannel.on("error", (error) => {
        console.error("[AMQP] confirmed channel error =>", error.message);
      });

      // On close
      confirmedChannel.on("close", () => {
        console.error("[AMQP] confirmed channel closed");
      });
      // await confirmedChannel.waitForConfirms();
      return confirmedChannel;
    } catch (error) {
      console.error("[AMQP] confirmed channel error =>", error.message);
      throw new Error(error);
    }
  }

  /**
   * Create channel
   * @param channelName
   */
  private async createChannel(channelName): Promise<Channel> {
    try {
      if (this.channels[channelName]) {
        return this.channels[channelName];
      }

      const createdChannel = await this.connection.createChannel();
      createdChannel.prefetch(this.configChannels[channelName].prefetch);
      // On error
      createdChannel.on("error", (error) => {
        console.error(
          `[AMQP] channel ${channelName} error event =>`,
          error.message
        );
      });

      // On close
      createdChannel.on("close", () => {
        console.log(`[AMQP] channel ${channelName} closed`);
      });

      return createdChannel;
    } catch (error) {
      console.error(`[AMQP] channel ${channelName} error =>`, error.message);
      throw new Error(error);
    }
  }

  /**
   * Channel assert exchange and queue and bind them
   * @param queue
   */
  private async channelAssertion(queue: IPublish) {
    try {
      const channel = this.channels[queue.CHANNEL_NAME];
      const { QUEUE } = queue;
      if (!queue.CHANNEL_NAME) {
        return;
      }

      await channel.assertQueue(QUEUE.QUEUE_NAME, QUEUE.HEADERS);

      if (QUEUE.EXCHANGE) {
        await channel.assertExchange(
          QUEUE.EXCHANGE.name,
          QUEUE.EXCHANGE.type,
          QUEUE.EXCHANGE.headers
        );
        await channel.bindQueue(
          QUEUE.QUEUE_NAME,
          QUEUE.EXCHANGE.name,
          QUEUE.QUEUE_NAME
        );
      }
    } catch (error) {
      console.error(
        `Channel assert queue ${queue.QUEUE.QUEUE_NAME} error =>`,
        error.message
      );
      throw new Error(error);
    }
  }

  /**
   * Decide way of sending message to rabbitMQ and publish
   * .If queue have exchange will send by publisher function
   * .If queue doesn't have exchange will send by sendToQueue function
   * @param queue
   * @param payload
   * @param options
   */
  async publish(queue: IPublish, payload, options?: object | PublishOptions) {
    if (queue.QUEUE.hasOwnProperty("EXCHANGE")) {
      return await this.publisher(queue, payload, options);
    }

    return await this.sendToQueue(queue, payload, options);
  }

  /**
   * Directly send to queue without any exchange or rule
   * @param queue
   * @param payload
   * @param options
   */
  private async sendToQueue(
    queue: IPublish,
    payload,
    options: PublishOptions = { messageId: uuid() }
  ) {
    const confirmedChannel = this.channels[queue.CHANNEL_NAME];

    return new Promise((resolve) => {
      confirmedChannel.sendToQueue(
        queue.QUEUE.QUEUE_NAME,
        Buffer.from(JSON.stringify([payload])),
        options,
        async (err, ok) => {
          if (err) {
            console.log(err);
          }

          return resolve(ok);
        }
      );
    });
  }

  /**
   * Publish
   * @param queue
   * @param payload
   * @param options
   */
  private async publisher(
    queue: IPublish,
    payload,
    options: PublishOptions = { messageId: uuid() }
  ) {
    const confirmedChannel = this.channels[queue.CHANNEL_NAME];
    let headers: { [k: string]: any } = {};
    switch (queue.QUEUE.EXCHANGE.type) {
      case this.configExchanges.BUNNY.type: {
        headers = { "x-delay": options?.delayTime || 0 };
        break;
      }
      case this.configExchanges.SINGLE_ACTIVE.type: {
        headers = { "x-single-active-consumer": true };
        break;
      }
      default: {
        break;
      }
    }
    options.headers = headers;
    if (options.delayTime) delete options.delayTime;

    return new Promise((resolve) => {
      confirmedChannel.publish(
        queue.QUEUE.EXCHANGE.name,
        queue.QUEUE.QUEUE_NAME,
        Buffer.from(JSON.stringify([payload])),
        options,
        async (err, ok) => {
          if (err) {
            console.log(err);
          }

          return resolve(ok);
        }
      );
    });
  }

  /**
   * Consume
   * @param queue
   */
  private async consumer(queue: IPublish) {
    console.log("CONSUMING....", queue.QUEUE.QUEUE_NAME);
    const channel = this.channels[queue.CHANNEL_NAME];
    if (!channel) {
      throw new Error("Channel not found!");
    }

    await channel.consume(queue.QUEUE.QUEUE_NAME, async (result) => {
      try {
        const handler = this.handlers[queue.QUEUE.QUEUE_NAME];
        if (isNil(result) || isNil(handler)) {
          console.log(
            `no handler for ${queue.QUEUE.QUEUE_NAME} or result is null`
          );
          return;
        }

        const content = JSON.parse(result.content.toString())[0];
        await handler(content);
        await channel.ack(result);
      } catch (error) {
        console.log(error);
        const consumeErrorCount = await this.cacheManager.get(
          result.properties.messageId
        );
        if (this.consumerRetry && consumeErrorCount > this.consumerRetry) {
          console.log(
            `Error in consumer ${queue.QUEUE.QUEUE_NAME} with message: `,
            result
          );
          await channel.ack(result);
        } else {
          await this.cacheManager.set(
            result.properties.messageId,
            +consumeErrorCount + 1
          );
          await channel.nack(result);
        }
      }
    });
  }

  /**
   * Set handler for consumer
   * @param queue
   * @param callback
   */
  public on = (queue: IPublish, callback: (result: any) => void) => {
    console.log(`new handler registered ${queue.QUEUE.QUEUE_NAME}`);
    this.handlers[queue.QUEUE.QUEUE_NAME] = callback;
  };
}
