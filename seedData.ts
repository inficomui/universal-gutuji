// import { sequelize } from "../src/utils/db"
// import { Video } from "../src/models/Video"

import { Video } from "./models/Video.ts"
import { sequelize } from "./utils/db.ts"

async function main() {
  const count = 100
  const prefix = "L1_V"
  const levelId = 1
  const videoPath: string | null = "uploads/sample.mp4"
  const testPdfPath: string | null = "uploads/sample.pdf"

  const adjectives = ["Essential","Advanced","Complete","Quick","Smart","Ultimate","Core","Turbo","Prime","Pro"]
  const topics = ["Concepts","Techniques","Basics","Foundations","Mastery","Strategies","Workshop","Guide","Walkthrough","Tutorial"]
  const rand = (arr: string[]) => arr[Math.floor(Math.random()*arr.length)]

  const rows = Array.from({ length: count }, (_v, i) => {
    const n = i + 1
    return {
      key: `${prefix}${n}`,
      title: `${rand(adjectives)} ${rand(topics)} ${n}`,
      description: `Auto-generated video #${n} for level ${levelId}.`,
      levelId,
      isActive: true,
      path: videoPath,
      testPdf: testPdfPath,
    }
  })

  await sequelize.authenticate()
  await Video.bulkCreate(rows, { ignoreDuplicates: true })
  console.log(`Seeded ${count} videos with prefix ${prefix}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
