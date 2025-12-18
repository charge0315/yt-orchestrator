/**
 * 手動シードスクリプト
 * MongoDB に接続して初期データを投入し、終了します。
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { seedInitialData } from '../utils/seedData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function main() {
  try {
    await connectDatabase()
    const result = await seedInitialData()
    if (result) {
      console.log('✅ seed が完了しました:', result)
    } else {
      console.log('ℹ️ seed をスキップしました（データが既に存在するか、無効化されています）')
    }
  } catch (error) {
    console.error('❌ seed に失敗しました:', error)
    process.exitCode = 1
  } finally {
    await disconnectDatabase()
  }
}

main()
