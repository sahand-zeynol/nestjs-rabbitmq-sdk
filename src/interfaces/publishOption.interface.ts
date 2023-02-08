import { IQueue } from './queue.interface';

export interface IQueueWithExchange {
  delayTime: number;
}

export interface IPublish {
  QUEUE: IQueue;
  CHANNEL_NAME: string;
}
