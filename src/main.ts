import { NestFactory }    from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule }      from './app.module';
import * as http  from 'http';
import * as https from 'https';
import { buildHttpsOptions } from './ssl/ssl-config.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });

  // Este servicio ES el consumer de auditoría: debe escuchar Kafka siempre,
  // sin flag de activación/desactivación (esa flag es para los productores).
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

  await app.startAllMicroservices();
  await app.init();
  const expressApp = app.getHttpAdapter().getInstance();

  const port = Number(process.env.PORT ?? 10400);
  http.createServer(expressApp).listen(port, () => {
    console.log(`[ms-lg-pruebas-kafka] HTTP  -> http://localhost:${port}/audit`);
    console.log(`[ms-lg-pruebas-kafka] Kafka: ${process.env.KAFKA_BROKER ?? 'localhost:9092'} → topic:${process.env.KAFKA_TOPIC ?? 'platform.logs'}`);
  });

  const httpsOptions = buildHttpsOptions();
  if (httpsOptions) {
    const sslPort = Number(process.env.SSL_PORT ?? 20400);
    try {
      https.createServer(httpsOptions, expressApp).listen(sslPort, () => {
        console.log(`[ms-lg-pruebas-kafka] HTTPS -> https://localhost:${sslPort}`);
      });
    } catch (e: any) {
      console.error('Error al iniciar HTTPS:', e.message, '— solo HTTP activo');
    }
  }
}
bootstrap();
