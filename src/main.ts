import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'ms-lg-pruebas-kafka-consumer',
        brokers:  (process.env.KAFKA_BROKER ?? 'localhost:9092').split(','),
      },
      consumer: { groupId: 'ms-lg-pruebas-kafka-group' },
    },
  });

  app.enableCors();
  await app.startAllMicroservices();
  const port = process.env.PORT ?? 10400;
  await app.listen(port);
  console.log(`[ms-lg-pruebas-kafka] HTTP:  http://localhost:${port}/audit`);
  console.log(`[ms-lg-pruebas-kafka] Kafka: ${process.env.KAFKA_BROKER ?? 'localhost:9092'} → topic:${process.env.KAFKA_TOPIC ?? 'platform.logs'}`);
}
bootstrap();
