import { CACHE_MANAGER, DynamicModule, Module } from "@nestjs/common";
import { RmqService } from "./rmq.service";
import { IRMQOptions } from "./interfaces/rmq.service.options";
import { Cache } from "cache-manager";

@Module({})
export class RmqModule {
  static forRoot(options: IRMQOptions): DynamicModule {
    const providers = [
      {
        provide: RmqService,
        inject: [CACHE_MANAGER],
        useFactory: (cacheManager: Cache) => {
          return new RmqService(options, cacheManager);
        },
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
