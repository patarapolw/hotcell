import { FastifyInstance } from 'fastify'
import dotProp from 'dot-prop'
import dayjs from 'dayjs'

import { getDb, getMeta } from '../db/shared'
import { safeColumnName, SQLParams } from '../db/util'
import { splitOp, ISplitOpToken } from '../db/shlex'

export default (f: FastifyInstance, _: any, next: () => void) => {
  f.get('/info', {
    schema: {
      tags: ['table'],
      summary: 'Get table information',
      querystring: {
        type: 'object',
        required: ['table'],
        properties: {
          table: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            table: { type: 'string' },
            columns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  cid: { type: 'integer' },
                  name: { type: 'string' },
                  type: { type: 'string' },
                  notnull: { type: 'integer' },
                  dflt_value: {},
                  pk: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  }, async (req) => {
    const db = await getDb()
    const { table } = req.query

    const columns = await db.all(/*sql*/`
    PRAGMA table_info(${safeColumnName(table)})
    `)

    return {
      table,
      columns
    }
  })

  f.post('/q', {
    schema: {
      tags: ['table'],
      summary: 'Query for data',
      body: {
        type: 'object',
        required: ['table'],
        properties: {
          table: { type: 'string' },
          q: { type: 'string' },
          where: { type: 'string' },
          offset: { type: 'integer' },
          limit: { type: ['integer', 'null'] },
          sort: { type: 'array', items: { type: 'string' } },
          hasCount: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            result: { type: 'array', items: {} },
            columns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  cid: { type: 'integer' },
                  name: { type: 'string' },
                  type: { type: 'string' },
                  notnull: { type: 'integer' },
                  dflt_value: {},
                  pk: { type: 'integer' }
                }
              }
            },
            count: { type: 'integer' }
          }
        }
      }
    }
  }, async (req) => {
    const { table, q = '', where, offset = 0, limit = 10, sort = [], hasCount = true } = req.body

    const db = await getDb()
    const { meta } = await getMeta()

    const columns: {
      name: string
      type: string
    }[] = await db.all(/*sql*/`
    PRAGMA table_info(${safeColumnName(table)})
    `)

    const strCols = columns.filter(c => c.type === 'TEXT').map(c => c.name)
    const numCols = columns.filter(c => ['INTEGER', 'REAL'].includes(c.type)).map(c => c.name)
    const colTypes = dotProp.get<Record<string, { type: string }>>(meta, 'col', {})

    const p = new SQLParams()

    const qFromToken = (t: ISplitOpToken): string => {
      if (!t.k) {
        return `(${strCols.map(c => qFromToken({
          ...t,
          k: c
        })).join(' OR ') || 'TRUE'})`
      }

      let v: any = t.v

      if (numCols.includes(t.v)) {
        v = parseFloat(t.v)
      } else if (colTypes[t.k] && colTypes[t.k].type === 'date') {
        v = +dayjs(t.v).toDate()
      }

      if (!t.op || t.op === ':') {
        if (strCols.includes(t.k)) {
          return `${safeColumnName(t.k)} LIKE '%'||${p.add(t.v)}||'%'`
        } else {
          return `${safeColumnName(t.k)} = ${p.add(v)}`
        }
      }

      return `${safeColumnName(t.k)} ${t.op} ${p.add(v)}`
    }

    const condQ = splitOp(q)

    const cond = {
      and: condQ.filter(c => !c.prefix),
      or: condQ.filter(c => c.prefix === '?'),
      not: condQ.filter(c => c.prefix === '-')
    }

    let strCond = cond.not.length > 0
      ? `NOT (${cond.not.map(t => qFromToken(t)).join(' AND ')})`
      : 'TRUE'
    strCond = `${cond.and.length > 0
      ? cond.and.map(t => qFromToken(t)).join(' AND ')
      : 'TRUE'} AND ${strCond}`
    strCond = (() => {
      const strOr = cond.or.length > 0
        ? cond.and.map(t => qFromToken(t)).join(' OR ')
        : ''
      return strOr ? `${strOr} OR (${strCond})` : strCond
    })()

    if (where) {
      strCond = `(${strCond}) AND (${where})`
    }

    const strSort = sort.map((s: string) => s[0] === '-' ? `${s.substr(1)} DESC` : `${s} ASC NULLS LAST`).join(',')

    const baseSql = /*sql*/`
    FROM ${safeColumnName(table)}
    WHERE ${strCond}
    `

    const [rData, rCount] = await Promise.all([
      db.all(/*sql*/`
      SELECT *, ROWID
      ${baseSql}
      ${sort.length > 0 ? `ORDER BY ${strSort}` : ''}
      ${limit ? `LIMIT ${limit}` : ''} OFFSET ${offset}
      `, p.data),
      hasCount ? db.get(/*sql*/`
      SELECT COUNT(*) AS [count]
      ${baseSql}
      `, p.data) : null
    ])

    return {
      result: rData,
      columns,
      count: rCount
        ? rCount.count
        : hasCount ? 0 : undefined
    }
  })

  next()
}
