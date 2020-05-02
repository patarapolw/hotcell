import { FastifyInstance } from 'fastify'
import { getDb, closeDb, getDbMeta } from '../db/shared'

export default (f: FastifyInstance, _: any, next: () => void) => {
  f.get('/info', {
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
    return await getDbMeta()
  })

  f.patch('/', {
    schema: {
      tags: ['file'],
      summary: 'Update database metadata',
      querystring: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string' }
        }
      },
      body: {
        type: 'object'
      }
    }
  }, async (req, reply) => {
    const { path } = req.query
    const db = await getDb(path)

    await db.exec(/*sql*/`
    CREATE TABLE IF NOT EXISTS __user (
      meta  TEXT NOT NULL DEFAULT '{}'
    )`)

    const r = await db.run(/*sql*/`
    UPDATE __user
    SET meta = ?
    `, JSON.stringify(req.body))

    if (!r.changes) {
      try {
        await db.run(/*sql*/`
        INSERT INTO __user (meta) VALUES (?)
        `, JSON.stringify(req.body))
      } catch (_) {}
    }

    reply.status(201).send()
  })

  f.delete('/', {
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
