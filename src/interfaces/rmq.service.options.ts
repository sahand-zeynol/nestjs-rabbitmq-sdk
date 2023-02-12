import { IChannel } from "./channel.interface";
import { IExchange } from "./exchange.interface";
import { IPublish } from "./publishOption.interface";
import { IQueue } from "./queue.interface";

export interface IRMQOptions {
  url: string;
  channels: Record<string, IChannel>;
  exchanges: Record<string, IExchange>;
  queues: Record<string, IQueue>;
  consumers: Record<string, IPublish>;
  publishers: Record<string, IPublish>;
  isGlobal?: boolean;
  consumerRetry?: number;
}
