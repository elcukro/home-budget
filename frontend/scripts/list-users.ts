import { PrismaClient, User, Settings } from '@prisma/client'

const prisma = new PrismaClient()

type UserWithSettings = User & {
  settings: Settings | null
}

async function main() {
  const users = await prisma.user.findMany({
    include: {
      settings: true,
    },
  })
  
  console.log('\nUsers in the database:')
  console.log('====================\n')
  
  users.forEach((user: UserWithSettings, index: number) => {
    console.log(`${index + 1}. User:`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Name: ${user.name || 'Not set'}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Settings:`)
    if (user.settings) {
      console.log(`     Language: ${user.settings.language}`)
      console.log(`     Currency: ${user.settings.currency}`)
    } else {
      console.log(`     No settings found`)
    }
    console.log('')
  })
  
  console.log(`Total users: ${users.length}\n`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  }) 