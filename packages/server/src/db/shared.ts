import { open, Database } from 'sqlite'
import sqlite3 from 'sqlite3'

let db: Database | null = null

export async function getDb (filename?: string): Promise<Database> {
  if (!filename) {
    if (!db) {
      throw new Error('Please open a database first.')
    }

    return db
  }

  if (db) {
    if (db.config.filename !== filename) {
      await db.close()
      db = await open({
        filename,
        driver: sqlite3.Database
      })
    }
  } else {
    db = await open({
      filename,
      driver: sqlite3.Database
    })
  }

  return db
}

export async function closeDb (): Promise<void> {
  if (db) {
    await db.close()
  }

  db = null
}

export async function getMeta () {
  const db = await getDb()

  const tables: string[] = (await db.all(/*sql*/`
  SELECT [name] FROM sqlite_master
  WHERE [type] = 'table' AND [name] NOT LIKE 'sqlite_%'
  `)).map(it => it.name)

  let meta: any = {}

  if (tables.includes('__user')) {
    const { m } = await db.get(/*sql*/`
      SELECT meta AS m FROM __user
      `) || {}
    meta = JSON.parse(m)
  }

  return {
    tables,
    meta
  }
}
