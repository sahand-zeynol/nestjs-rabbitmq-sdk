import { IExchange } from './exchange.interface';

export interface IQueueHeaders {
  durable: boolean;
}

export interface IQueueSingleActiveHeaders extends IQueueHeaders {
  arguments: { 'x-single-active-consumer': boolean };
}

export interface IQueue {
  QUEUE_NAME: string;
  HEADERS?: object;
  EXCHANGE?: IExchange;
}
