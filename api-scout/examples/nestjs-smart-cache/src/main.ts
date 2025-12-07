/**
 * This is a standalone example of how to implement Smart Caching support in NestJS.
 * 
 * To run this (conceptually):
 * 1. Install dependencies: npm i @nestjs/core @nestjs/common @nestjs/swagger
 * 2. Run: npx ts-node main.ts
 */

import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Param } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as crypto from 'crypto';

// --- 1. Define a Sample Controller ---
@Controller('cats')
class CatsController {
    @Get()
    findAll(): string[] {
        return ['Mèo Mướp', 'Mèo Mun', 'Mèo Tam Thể'];
    }

    @Get(':id')
    findOne(@Param('id') id: string): string {
        return `Cat #${id}`;
    }
}

// --- 2. Define Module ---
@Module({
    controllers: [CatsController],
})
class AppModule { }

// --- 3. Bootstrap Function ---
async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Setup Swagger
    const config = new DocumentBuilder()
        .setTitle('API Scout Demo')
        .setDescription('A simple API to demonstrate Smart Caching')
        .setVersion('1.0')
        .addTag('cats')
        .build();

    const document = SwaggerModule.createDocument(app, config);

    // --- ✨ MAGIC SAUCE: Calculate Hash ---
    // We hash the JSON document so API Scout can quickly check for changes
    const docString = JSON.stringify(document);
    const docHash = crypto.createHash('md5').update(docString).digest('hex');

    // Setup Swagger UI
    SwaggerModule.setup('api/docs', app, document);

    // --- ✨ MAGIC SAUCE: Expose Hash Endpoint ---
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.get('/api/docs-hash', (req, res) => {
        // API Scout will poll this. If it changes, it fetches the full docs.
        res.setHeader('Content-Type', 'text/plain');
        res.send(docHash);
    });

    await app.listen(3000);
    console.log(`Application is running on: http://localhost:3000`);
    console.log(`Swagger Docs: http://localhost:3000/api/docs`);
    console.log(`Smart Cache Hash: http://localhost:3000/api/docs-hash (Hash: ${docHash})`);
    console.log(`\nTry modifying the 'CatsController' and restarting to see the hash change!`);
}

bootstrap();
