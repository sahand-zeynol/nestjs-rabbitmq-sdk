export interface IChannel {
  name: string;
  prefetch?: number;
  type: 'consumer' | 'publisher';
}
