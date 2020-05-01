import { FastifyInstance } from 'fastify'
import { getDb, closeDb, getMeta } from '../db/shared'

export default (f: FastifyInstance, _: any, next: () => void) => {
  f.put('/open', {
    schema: {
      tags: ['file'],
      summary: 'Open a new database and get information',
      querystring: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            tables: { type: 'array', items: { type: 'string' } },
            meta: {}
          }
        }
      }
    }
  }, async (req) => {
    await getDb(req.query.path)
    return await getMeta()
  })

  f.delete('/close', {
    schema: {
      tags: ['file'],
      summary: 'Close the database'
    }
  }, async (_, reply) => {
    await closeDb()

    reply.status(201).send()
  })

  next()
}
