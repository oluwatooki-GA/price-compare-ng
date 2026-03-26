import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PriceCompare NG API',
      version: '1.0.0',
      description: 'API for comparing product prices across Nigerian e-commerce platforms',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}/api/v1`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
            },
          },
        },
        Token: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT access token',
            },
            tokenType: {
              type: 'string',
              default: 'bearer',
              description: 'Token type',
            },
          },
        },
        ProductData: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              description: 'E-commerce platform name',
              example: 'jumia',
            },
            name: {
              type: 'string',
              description: 'Product name',
            },
            price: {
              type: 'number',
              description: 'Product price',
            },
            currency: {
              type: 'string',
              description: 'Currency code',
              example: 'NGN',
            },
            rating: {
              type: 'number',
              nullable: true,
              description: 'Product rating (0-5)',
            },
            reviewCount: {
              type: 'integer',
              description: 'Number of reviews',
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'Product URL',
            },
            availability: {
              type: 'boolean',
              description: 'Product availability status',
            },
            imageUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'Product image URL',
            },
          },
        },
        ComparisonResult: {
          type: 'object',
          properties: {
            products: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ProductData',
              },
            },
            bestValueIndex: {
              type: 'integer',
              description: 'Index of the best value product',
            },
            searchQuery: {
              type: 'string',
              description: 'Original search query',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Search timestamp',
            },
          },
        },
      },
    },
  },
  apis: ['./src/api/v1/**/*.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
