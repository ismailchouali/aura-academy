import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  await prisma.user.upsert({
    where: { email: 'auraadmin@gmail.com' },
    update: {},
    create: {
      email: 'auraadmin@gmail.com',
      password: adminPassword,
      fullName: 'مدير النظام',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user created');

  // Create secretary user
  const secPassword = await hashPassword('secretary123');
  await prisma.user.upsert({
    where: { email: 'secr@gmail.com' },
    update: {},
    create: {
      email: 'secr@gmail.com',
      password: secPassword,
      fullName: 'سكرتير',
      role: 'SECRETARY',
    },
  });
  console.log('✅ Secretary user created');

  // Create default services
  const langues = await prisma.service.upsert({
    where: { id: 'service_langues' },
    update: {},
    create: {
      id: 'service_langues',
      name: 'Langues',
      nameAr: 'اللغات',
      nameFr: 'Langues',
      order: 1,
    },
  });

  const soutien = await prisma.service.upsert({
    where: { id: 'service_soutien' },
    update: {},
    create: {
      id: 'service_soutien',
      name: 'Soutien Scolaire',
      nameAr: 'الدعم المدرسي',
      nameFr: 'Soutien Scolaire',
      order: 2,
    },
  });

  const informatique = await prisma.service.upsert({
    where: { id: 'service_info' },
    update: {},
    create: {
      id: 'service_info',
      name: 'Informatique',
      nameAr: 'المعلوميات',
      nameFr: 'Informatique',
      order: 3,
    },
  });
  console.log('✅ Services created');

  // Create subjects for Langues
  const francais = await prisma.subject.upsert({
    where: { id: 'subject_francais' },
    update: {},
    create: {
      id: 'subject_francais',
      name: 'Français',
      nameAr: 'الفرنسية',
      nameFr: 'Français',
      serviceId: langues.id,
      order: 1,
    },
  });

  const anglais = await prisma.subject.upsert({
    where: { id: 'subject_anglais' },
    update: {},
    create: {
      id: 'subject_anglais',
      name: 'Anglais',
      nameAr: 'الإنجليزية',
      nameFr: 'Anglais',
      serviceId: langues.id,
      order: 2,
    },
  });

  const espagnol = await prisma.subject.upsert({
    where: { id: 'subject_espagnol' },
    update: {},
    create: {
      id: 'subject_espagnol',
      name: 'Espagnol',
      nameAr: 'الإسبانية',
      nameFr: 'Espagnol',
      serviceId: langues.id,
      order: 3,
    },
  });

  // Create subjects for Soutien
  const maths = await prisma.subject.upsert({
    where: { id: 'subject_maths' },
    update: {},
    create: {
      id: 'subject_maths',
      name: 'Mathématiques',
      nameAr: 'الرياضيات',
      nameFr: 'Mathématiques',
      serviceId: soutien.id,
      order: 1,
    },
  });

  const physique = await prisma.subject.upsert({
    where: { id: 'subject_physique' },
    update: {},
    create: {
      id: 'subject_physique',
      name: 'Physique-Chimie',
      nameAr: 'الفيزياء والكيمياء',
      nameFr: 'Physique-Chimie',
      serviceId: soutien.id,
      order: 2,
    },
  });

  const svt = await prisma.subject.upsert({
    where: { id: 'subject_svt' },
    update: {},
    create: {
      id: 'subject_svt',
      name: 'SVT',
      nameAr: 'علوم الحياة والأرض',
      nameFr: 'SVT',
      serviceId: soutien.id,
      order: 3,
    },
  });
  console.log('✅ Subjects created');

  // Create levels for each subject
  const levels = [
    { name: 'A1 Débutant', nameAr: 'مبتدئ A1', nameFr: 'A1 Débutant' },
    { name: 'A2 Élémentaire', nameAr: 'عنصري A2', nameFr: 'A2 Élémentaire' },
    { name: 'B1 Intermédiaire', nameAr: 'متوسط B1', nameFr: 'B1 Intermédiaire' },
    { name: 'B2 Intermédiaire Sup', nameAr: 'متوسط عليا B2', nameFr: 'B2 Intermédiaire Sup' },
    { name: 'C1 Avancé', nameAr: 'متقدم C1', nameFr: 'C1 Avancé' },
    { name: 'C2 Maîtrise', nameAr: 'إتقان C2', nameFr: 'C2 Maîtrise' },
  ];

  const soutienLevels = [
    { name: '6ème année', nameAr: 'السنة السادسة', nameFr: '6ème année' },
    { name: '5ème année', nameAr: 'السنة الخامسة', nameFr: '5ème année' },
    { name: '4ème année', nameAr: 'السنة الرابعة', nameFr: '4ème année' },
    { name: '3ème année', nameAr: 'السنة الثالثة', nameFr: '3ème année' },
    { name: '2ème année Bac', nameAr: 'الثانية بكالوريا', nameFr: '2ème année Bac' },
    { name: '1ère année Bac', nameAr: 'الأولى بكالوريا', nameFr: '1ère année Bac' },
  ];

  const langSubjects = [francais, anglais, espagnol];
  for (const subject of langSubjects) {
    for (let i = 0; i < levels.length; i++) {
      await prisma.level.upsert({
        where: { id: `level_${subject.id}_${i}` },
        update: {},
        create: {
          id: `level_${subject.id}_${i}`,
          ...levels[i],
          subjectId: subject.id,
          order: i + 1,
        },
      });
    }
  }

  const soutienSubjects = [maths, physique, svt];
  for (const subject of soutienSubjects) {
    for (let i = 0; i < soutienLevels.length; i++) {
      await prisma.level.upsert({
        where: { id: `level_${subject.id}_${i}` },
        update: {},
        create: {
          id: `level_${subject.id}_${i}`,
          ...soutienLevels[i],
          subjectId: subject.id,
          order: i + 1,
        },
      });
    }
  }
  console.log('✅ Levels created');

  // Create default classrooms
  const classrooms = ['القاعة A', 'القاعة B', 'القاعة C'];
  const classroomsFr = ['Salle A', 'Salle B', 'Salle C'];
  for (let i = 0; i < classrooms.length; i++) {
    await prisma.classroom.upsert({
      where: { id: `classroom_${i}` },
      update: {},
      create: {
        id: `classroom_${i}`,
        name: classroomsFr[i],
        nameAr: classrooms[i],
        capacity: 20,
      },
    });
  }
  console.log('✅ Classrooms created');

  // Create default settings
  const defaultSettings = [
    { key: 'centerName', value: 'Aura Academy' },
    { key: 'centerPhone', value: '0606030356' },
    { key: 'centerAddress', value: 'بني ملال، شارع محمد الخامس' },
    { key: 'centerAddressFr', value: 'Béni Mellal, Bd Mohamed V' },
    { key: 'openTime', value: '08:00' },
    { key: 'closeTime', value: '20:00' },
    { key: 'openDays', value: '1,2,3,4,5,6' },
    { key: 'currency', value: 'DH' },
  ];
  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('✅ Settings created');

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
