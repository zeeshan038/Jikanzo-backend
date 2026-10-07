import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const activitiesData = [
  {
    name: 'Coffee Meetups',
    description: 'Enjoy a relaxing coffee meetup.',
    subActivities: ['Coffee Meetups', 'Coffee Cafe', 'Coffee in Mall'],
  },
  {
    name: 'Dining',
    description: 'Fine dining or casual meals.',
    subActivities: ['Dining Meetups', 'Dining Cafe', 'Dining in Mall'],
  },
  {
    name: 'Walks',
    description: 'A nice walk in various locations.',
    subActivities: ['Walk in Park', 'Walk in City', 'Night Walk'],
  },
  {
    name: 'Entertainment',
    description: 'Movies, concerts, and shows.',
    subActivities: ['Movie', 'Concert', 'Theater'],
  },
  {
    name: 'Sports',
    description: 'Active sports meetups.',
    subActivities: ['Tennis', 'Golf', 'Bowling'],
  },
  {
    name: 'Nightlife',
    description: 'Enjoying the local nightlife.',
    subActivities: ['Clubbing', 'Bar Hopping', 'Pub'],
  },
  {
    name: 'Shopping',
    description: 'Retail therapy together.',
    subActivities: ['Mall Shopping', 'Boutique', 'Thrift Shopping'],
  },
  {
    name: 'Fitness',
    description: 'Working out or taking a class.',
    subActivities: ['Gym', 'Yoga', 'Pilates'],
  },
  {
    name: 'Sightseeing',
    description: 'Exploring the city landmarks.',
    subActivities: ['Museums', 'Landmarks', 'Art Galleries'],
  },
  {
    name: 'Gaming',
    description: 'Arcades, PC gaming, or board games.',
    subActivities: ['Arcade', 'PC Gaming Cafe', 'Board Games'],
  },
];

async function main() {
  console.log('Seeding 10 activities...');

  for (const activity of activitiesData) {
    const createdActivity = await prisma.activity.upsert({
      where: { name: activity.name },
      update: {},
      create: {
        name: activity.name,
        description: activity.description,
        isActive: true,
      },
    });

    for (const subName of activity.subActivities) {
      // Create sub-activities for this activity
      await prisma.subActivity.create({
        data: {
          activityId: createdActivity.id,
          name: subName,
          description: subName,
          isActive: true,
        },
      });
    }

    console.log(`Created Activity: ${createdActivity.name}`);
  }

  console.log('Finished seeding activities!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
