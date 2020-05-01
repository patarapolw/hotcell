import { FastifyInstance } from 'fastify'
import swagger from 'fastify-oas'

import fileRouter from './file'
import tableRouter from './table'
import { PORT } from '../config'

export default (f: FastifyInstance, _: any, next: () => void) => {
  f.register(swagger, {
    routePrefix: '/doc',
    swagger: {
      info: {
        title: 'Swagger API',
        version: '0.1.0'
      },
      consumes: ['application/json'],
      produces: ['application/json'],
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: 'Local server'
        }
      ]
    },
    exposeRoute: true
  })

  f.register(require('fastify-cors'))

  f.register(fileRouter, { prefix: '/file' })
  f.register(tableRouter, { prefix: '/table' })

  next()
}
