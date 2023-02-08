import { IChannel } from "./channel.interface";
import { IExchange } from "./exchange.interface";
import { IPublish } from "./publishOption.interface";
import { IQueue } from "./queue.interface";

export interface IRMQOptions {
  url: string;
  channels: { [key: string]: IChannel };
  exchanges: { [key: string]: IExchange };
  queues: { [key: string]: IQueue };
  consumers: { [key: string]: IPublish };
  publishers: { [key: string]: IPublish };
  isGlobal?: boolean;
}
