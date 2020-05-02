import { FastifyInstance } from 'fastify'
import dotProp from 'dot-prop'
import dayjs from 'dayjs'

import { getDb, getTableMeta, getDbMeta } from '../db/shared'
import { safeColumnName, SQLParams, decode } from '../db/util'
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
            meta: {}
          }
        }
      }
    }
  }, async (req) => {
    const { table } = req.query
    const meta = await getTableMeta(table)

    return {
      table,
      meta
    }
  })

  f.post('/q', {
    schema: {
      tags: ['table'],
      summary: 'Query for data',
      querystring: {
        type: 'object',
        required: ['table'],
        properties: {
          table: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
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
            meta: {},
            count: { type: 'integer' }
          }
        }
      }
    }
  }, async (req) => {
    const table = req.query.table
    const { q = '', where, offset = 0, limit = 10, sort = [], hasCount = true } = req.body

    const db = await getDb()
    const meta = await getTableMeta(table)

    const strCols = meta.column.filter(c => c.type === 'TEXT').map(c => c.name)
    const numCols = meta.column.filter(c => ['INTEGER', 'REAL'].includes(c.type)).map(c => c.name)
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
      SELECT *, ROWID AS __id
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
      meta,
      count: rCount
        ? rCount.count
        : hasCount ? 0 : undefined
    }
  })

  f.patch('/', {
    schema: {
      tags: ['table'],
      summary: 'Edit a table',
      querystring: {
        type: 'object',
        required: ['table'],
        properties: {
          table: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          table: {
            type: 'object',
            properties: {
              index: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    name: { type: 'array', items: { type: 'string' }, minItems: 1 },
                    unique: { type: 'boolean' }
                    // delete: { type: 'boolean' } // Set to empty object to delete
                  }
                }
              }
            }
          },
          col: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                rename: { type: 'string' },
                pk: { type: 'boolean' },
                type: { type: 'boolean' },
                notnull: { type: 'boolean' },
                default: { type: ['string', 'number'] }
                // delete: { type: 'boolean' } // Set to empty object to delete
              }
            }
          },
          row: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                data: { type: 'object' }
                // delete: { type: 'boolean' } // Set to empty object to delete
              }
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    const { table } = req.query
    const [db, { meta: dbMeta }, tableMeta] = await Promise.all([
      getDb(),
      getDbMeta(),
      getTableMeta(table)
    ])

    if (req.body.table && req.body.table.index) {
      const idxMap = new Map<string, typeof tableMeta['index'][0]>()
      tableMeta.index.map((idx) => {
        idxMap.set(idx.name, idx)
      })

      await Promise.all(Object.entries<any>(req.body.table.index).map(async ([name, newIdx]) => {
        const oldIdx = idxMap.get(name)

        if (oldIdx) {
          await db.exec(/*sql*/`
          DROP INDEX ${oldIdx.name}
          `)
        }

        if (Object.keys(newIdx).length > 0) {
          const unique = typeof newIdx.unique === 'boolean' ? Number(newIdx.unique) : dotProp.get(oldIdx, 'unique', 0)
          await db.exec(/*sql*/`
          CREATE ${unique ? 'UNIQUE' : ''} INDEX ${name} ON ${safeColumnName(table)} (${newIdx.name.join(',')})
          `)
        }
      }))
    }

    if (req.body.col) {
      const colMap = new Map<string, typeof tableMeta['column'][0]>()
      tableMeta.column.map((c) => {
        colMap.set(c.name, c)
      })

      let canAlterTable = true

      const iOffset = colMap.size

      Array.from(colMap.keys()).map((k, i) => {
        const c = req.body.col[k]
        if (c) {
          canAlterTable = false
          colMap.set(k, {
            cid: iOffset + i,
            name: k,
            type: c.type,
            pk: c.pk ? Number(c.pk) : 0,
            notnull: c.notnull ? Number(c.notnull) : 0,
            dflt_value: c.default
          })
        }
      })

      if (canAlterTable) {
        const transformCInput = (c: any) => {
          if ([null, undefined].includes(c.default)) {
            c.default = undefined
          }

          const type = dotProp.get<string>(dbMeta, `${table}.col.${c.name}.type`, c.type)

          /**
           * https://www.sqlite.org/datatype3.html
           *
           * 3.1. Determination Of Column Affinity
           */
          if (type.includes('INT')) {
            c.default = [undefined, ''].includes(c.default) ? undefined : parseInt(c.default)
            c.type = 'INTEGER'
          } else if (['CHAR', 'CLOB', 'TEXT'].some(t => type.includes(t))) {
            c.type = 'TEXT'
          } else if (type.includes('BLOB')) {
            c.type = 'BLOB'
          } else if (['REAL', 'FLOA', 'DOUB'].some(t => type.includes(t))) {
            c.default = [undefined, ''].includes(c.default) ? undefined : parseFloat(c.default)
            c.type = 'REAL'
          } else if (type === 'boolean') {
            c.default = [undefined, ''].includes(c.default) ? undefined : c.default === 'FALSE' ? 0 : 1
            c.type = 'INTEGER'
          } else if (type === 'date') {
            c.default = [undefined, ''].includes(c.default) ? undefined : +dayjs(c.default).toDate()
            c.type = 'INTEGER'
          } else if (type.startsWith('json')) {
            c.default = [undefined, ''].includes(c.default) ? undefined : JSON.stringify(c.default)
            c.type = 'TEXT'
          }

          return c
        }
        await Promise.all(Object.entries<any>(req.body.col).map(async ([k, c]) => {
          c = transformCInput(c)

          await db.exec(/*sql*/`
          ALTER TABLE ${safeColumnName(table)} ADD COLUMN
          ${safeColumnName(k)} ${c.type} ${c.pk ? 'PRIMARY' : ''} ${typeof c.default !== 'undefined' ? `DEFAULT ${
            typeof c.default === 'number' ? c.default : `'${c.default.replace(/'/g, "[']")}'`
          }` : ''} ${c.notnull ? 'NOT NULL' : ''}
          `)
        }))
      } else {
        const cols = Array.from(colMap.values()).sort((a, b) => a.cid - b.cid)
        const colDef = (c: typeof cols[0]) => {
          return /*sql*/`
          ${safeColumnName(c.name)} ${c.type} ${c.pk ? 'PRIMARY' : ''} ${typeof c.dflt_value !== 'undefined' ? `DEFAULT ${
            typeof c.dflt_value === 'number' ? c.dflt_value : `'${c.dflt_value.replace(/'/g, "[']")}'`
          }` : ''} ${c.notnull ? 'NOT NULL' : ''}
          `
        }

        await db.exec(/*sql*/`
        -- disable foreign key constraint check
        PRAGMA foreign_keys=off;

        -- start a transaction
        BEGIN TRANSACTION;

        -- Here you can drop column or rename column
        CREATE TABLE IF NOT EXISTS __tmp ( 
          ${cols.map((c) => colDef(c)).join(',')}
        );
        -- copy data from the table to the new_table
        INSERT INTO __tmp (${cols.map((c) => safeColumnName(c.name)).join(',')})
        SELECT ${cols.map((c) => safeColumnName(c.name)).join(',')}
        FROM ${safeColumnName(table)};

        -- drop the table
        DROP TABLE ${safeColumnName(table)};

        -- rename the new_table to the table
        ALTER TABLE __tmp RENAME TO ${safeColumnName(table)}; 

        -- commit the transaction
        COMMIT;

        -- enable foreign key constraint check
        PRAGMA foreign_keys=on;
        `)
      }
    }

    if (req.body.row) {
      const toDrop = new Set<string | number>()
      const toUpsert = new Map<string | number, any>()

      Object.entries<any>(req.body.row).map(([sid, row]) => {
        const id = decode(sid)

        if (!row.data) {
          toDrop.add(id)
        } else {
          toUpsert.set(id, row.data)
        }
      })

      if (toDrop.size > 0) {
        await db.run(/*sql*/`
        DELETE FROM ${safeColumnName(table)}
        WHERE ROWID IN (${Array(toDrop.size).fill('?').join(',')})
        `, ...Array.from(toDrop))
      }

      await Promise.all(Array.from(toUpsert).map(async ([id, data]) => {
        const p1 = new SQLParams()

        const r = await db.run(/*sql*/`
        UPDATE ${safeColumnName(table)}
        SET ${Object.entries<any>(data).map(([k, v]) => `${safeColumnName(k)} = ${p1.add(v)}`).join(',')}
        WHERE ROWID = ${p1.add(id)}
        `, p1.data)

        if (!r.changes) {
          const entries = Object.entries<any>(data)
          const p2 = new SQLParams()

          await db.run(/*sql*/`
          INSERT INTO ${safeColumnName(table)} (${entries.map(([k]) => k).join(',')})
          VALUES (${entries.map(([_, v]) => p2.add(v))})
          `, p2.data)
        }
      }))
    }

    reply.status(201).send()
  })

  f.patch('/rename', {
    schema: {
      tags: ['table'],
      summary: 'Rename a table',
      querystring: {
        type: 'object',
        required: ['table', 'new'],
        properties: {
          table: { type: 'string' },
          new: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const db = await getDb()
    await db.exec(/*sql*/`
    ALTER TABLE ${safeColumnName(req.query.table)} RENAME TO ${safeColumnName(req.query.new)}
    `)

    reply.status(201).send()
  })

  f.delete('/', {
    schema: {
      tags: ['table'],
      summary: 'Delete a table',
      querystring: {
        type: 'object',
        required: ['table'],
        properties: {
          table: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const db = await getDb()
    await db.exec(/*sql*/`
    DROP TABLE IF EXISTS ${safeColumnName(req.query.table)}
    `)

    reply.status(201).send()
  })

  next()
}
