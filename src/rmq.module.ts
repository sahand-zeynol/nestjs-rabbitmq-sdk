import { DynamicModule, Module } from "@nestjs/common";
import { RmqService } from "./rmq.service";
import { IRMQOptions } from "./interfaces/rmq.service.options";

@Module({})
export class RmqModule {
  static forRoot(options: IRMQOptions): DynamicModule {
    const providers = [
      {
        provide: RmqService,
        useValue: new RmqService(options),
      },
    ];

    return {
      global: options.isGlobal,
      providers: providers,
      exports: providers,
      module: RmqModule,
    };
  }
}
