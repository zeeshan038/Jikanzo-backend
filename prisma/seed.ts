import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const firstNames = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy',
  'Kevin', 'Laura', 'Mallory', 'Nina', 'Oscar', 'Peggy', 'Quentin', 'Romeo', 'Sybil', 'Trent',
  'Ursula', 'Victor', 'Walter', 'Xena', 'Yvonne', 'Zack', 'Ava', 'Leo', 'Mia', 'Noah'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor',
  'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson',
  'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King'
];

const languagesList = ['English', 'Spanish', 'French', 'German', 'Italian', 'Japanese', 'Korean', 'Mandarin', 'Arabic', 'Russian'];
const activitiesList = ['Dinner', 'Coffee', 'Movies', 'Museum', 'Concert', 'Hiking', 'Shopping', 'City Tour', 'Gaming', 'Bowling'];
const genders = ['Female', 'Male', 'Non-binary'];
const trustRanks = ['New', 'Verified', 'Premium', 'Elite'];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number, decimals: number = 1) {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

async function main() {
  console.log('Starting seeding of 30 companions...');

  for (let i = 0; i < 30; i++) {
    const firstName = firstNames[i];
    const lastName = getRandomItem(lastNames);
    const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${i}`;
    const phone = `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const age = getRandomInt(21, 40);
    const hourlyRate = getRandomInt(30, 150);
    const isOnline = Math.random() > 0.5;
    
    // Distribute locations around a general area (e.g. Los Angeles)
    const locationLat = getRandomFloat(33.7, 34.3, 4);
    const locationLng = getRandomFloat(-118.6, -117.8, 4);
    
    const companionLanguages = getRandomItems(languagesList, getRandomInt(1, 3));
    const companionActivities = getRandomItems(activitiesList, getRandomInt(2, 5));
    const gender = getRandomItem(genders);
    const trustRank = getRandomItem(trustRanks);

    await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username: username,
        phone: phone,
        role: 'COMPANION',
        about: `Hi, I am ${firstName}! I love meeting new people and sharing great experiences.`,
        languages: companionLanguages,
        activityType: companionActivities,
        gender: gender,
        age: age,
        companionProfile: {
          create: {
            bio: `I am a ${trustRank.toLowerCase()} companion looking forward to spending time with you.`,
            hourlyRate: hourlyRate,
            locationLat: locationLat,
            locationLng: locationLng,
            serviceRadius: getRandomInt(5, 50),
            isOnline: isOnline,
            rating: getRandomFloat(3.5, 5.0, 1),
            trustRank: trustRank,
            totalSessions: getRandomInt(0, 100),
            repeatClients: getRandomInt(0, 30),
            jssScore: getRandomFloat(70.0, 100.0, 1),
            completedMeetups: getRandomInt(0, 90),
            reliabilityScore: getRandomFloat(80.0, 100.0, 1),
          },
        },
      },
    });

    console.log(`Created companion ${i + 1}/30: ${username}`);
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
