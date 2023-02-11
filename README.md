# nestjs-rabbitmq-sdk

# Description
This module created to handle all RabbitMQ features  including managing Channels, Exchanges, Queues, Publishers, and Consumers.

This package examples used [here](https://github.com/sahand-zeynol/nestjs-rabbitmq).

# Motivation

I found some RabbitMQ features which did't supported by NestJS and most of them initiated decentralized.
I tried to centralized initiation and use it wherever you want.
# Usage

Install
```bash
npm install ---save nestjs-rabbitmq-sdk
```
You can import `RmqModule` to the `imports` array of module for which you would like to discover handlers.   

 ```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IChannel, IExchange, IPublish, IQueue, RmqModule } from 'nestjs-rabbitmq-sdk';

const channels: { [key: string]: IChannel } = {
  default: {
    name: 'default',
    type: 'consumer',
    prefetch: 1,
  },
  confirmed: {
    name: 'confirmed',
    type: 'publisher',
  },
}

const exchanges: { [key: string]: IExchange } = {
  BUNNY: {
    name: `bunny_delay`,
    type: 'x-delayed-message',
    headers: { durable: true, arguments: { 'x-delayed-type': 'direct' } },
  },
}
const queues: { [key: string]: IQueue } = {
  SIMPLE: {
    QUEUE_NAME: `simple`,
  },
  BUNNY_DELAY: {
    QUEUE_NAME: `bunny_delay`,
    EXCHANGE: exchanges.BUNNY,
    HEADERS: { durable: true },
  },
}
const consumers: { [key: string]: IPublish } = {
  SIMPLE: {
    QUEUE: queues.SIMPLE,
    CHANNEL_NAME: channels.confirmed.name,
  },
  BUNNY_DELAY: {
    QUEUE: queues.BUNNY_DELAY,
    CHANNEL_NAME: channels.default.name,
  },
}
const publishers: { [key: string]: IPublish } = {
  BUNNY_DELAY: {
    QUEUE: queues.BUNNY_DELAY,
    CHANNEL_NAME: channels.confirmed.name,
  },
}
@Module({
  imports: [
    RmqModule.forRoot({
      url: 'amqp://guest:guest@localhost',
      isGlobal: true,
      channels,
      exchanges,
      queues,
      consumers,
      publishers

    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
 ```

 ## Usage with Services ( Consumer )
 If you imported `RmqModule` globally, you don't need to import it to module which you want to use.

 ```typescript
import { Injectable } from '@nestjs/common';
import { RmqService } from 'nestjs-rabbitmq-sdk';
import { consumers } from '../rabbitmq/consumer';

@Injectable()
export class ConsumersHandler {
  constructor(private readonly rmqService: RmqService) {
    this.rmqService.on(consumers.ERRORS, async (result) => {
      console.log('BUNNY-DELAY consumed: ', result);
    });
    this.rmqService.on(consumers.SIMPLE, async (result) => {
      console.log('SIMPLE consumed: ', result);
    });
  }
}

 ```

 ## Usage with Services ( Publisher )

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { RmqService } from 'nestjs-rabbitmq-sdk';
import { publishers } from '../rabbitmq/publisher';

@Injectable()
export class SimplePublisher implements OnModuleInit {
  constructor(private readonly rmqService: RmqService) { }

  async onModuleInit() {
    await delay(5000);
    await this.rmqService.publish(publishers.SIMPLE, 'simple');
  }
}
 ```

 # Contribute

 Contributions welcome!