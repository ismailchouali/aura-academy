import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

async function main() {
  console.log('🌱 Seeding Aura Academy database...\n');

  // ==========================================
  // 1. SETTINGS
  // ==========================================
  console.log('📋 Seeding Settings...');

  const settingsData: Prisma.SettingCreateInput[] = [
    { id: '1', key: 'center_name', value: 'Aura Academy' },
    { id: '2', key: 'center_phone', value: '0606030356' },
    { id: '3', key: 'center_address', value: 'بني ملال، شارع محمد الخامس، أمام مؤسسة أبي القاسم الصومعي، فوق مكتبة وورك بيرو، الطابق الثالث' },
    { id: '4', key: 'center_open_days', value: '11' },
    { id: '5', key: 'center_close_time', value: '22:30' },
    { id: '6', key: 'currency', value: 'MAD' },
  ];

  for (const s of settingsData) {
    await db.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log(`  ✅ ${settingsData.length} settings seeded\n`);

  // ==========================================
  // 2. CLASSROOMS
  // ==========================================
  console.log('🏫 Seeding Classrooms...');

  const classroomsData = [
    { name: 'Salle A', nameAr: 'القاعة A', capacity: 20 },
    { name: 'Salle B', nameAr: 'القاعة B', capacity: 20 },
    { name: 'Salle C', nameAr: 'القاعة C', capacity: 20 },
  ];

  for (const c of classroomsData) {
    await db.classroom.upsert({
      where: { id: `classroom_${c.name.split(' ')[1]}` },
      update: {},
      create: { id: `classroom_${c.name.split(' ')[1]}`, ...c },
    });
  }
  console.log(`  ✅ ${classroomsData.length} classrooms seeded\n`);

  // ==========================================
  // 3. SERVICE 1: Cours de Soutiens
  // ==========================================
  console.log('📚 Seeding Service: Cours de Soutiens...');

  const soutienService = await db.service.upsert({
    where: { id: 'service_soutien' },
    update: {},
    create: {
      id: 'service_soutien',
      name: 'Cours de Soutiens',
      nameAr: 'دروس الدعم',
      nameFr: 'Cours de Soutiens',
      icon: 'GraduationCap',
      order: 1,
    },
  });

  // Soutien subjects with their levels
  const soutienSubjects: {
    name: string; nameAr: string; nameFr: string;
    levels: { name: string; nameAr: string; nameFr: string }[];
  }[] = [
    {
      name: 'Math', nameAr: 'الرياضيات', nameFr: 'Mathématiques',
      levels: [
        { name: '3eme Année Collège', nameAr: 'السنة الثالثة إعدادي', nameFr: "3ème Année Collège" },
        { name: 'Tronc Commun', nameAr: 'الجذع المشترك', nameFr: 'Tronc Commun' },
        { name: '1er Bac', nameAr: 'السنة أولى باكالوريا', nameFr: '1ère Bac' },
        { name: '2eme Bac', nameAr: 'السنة الثانية باكالوريا', nameFr: '2ème Bac' },
      ],
    },
    {
      name: 'Physique', nameAr: 'الفيزياء', nameFr: 'Physique-Chimie',
      levels: [
        { name: '3eme Année Collège', nameAr: 'السنة الثالثة إعدادي', nameFr: "3ème Année Collège" },
        { name: 'Tronc Commun', nameAr: 'الجذع المشترك', nameFr: 'Tronc Commun' },
        { name: '1er Bac', nameAr: 'السنة أولى باكالوريا', nameFr: '1ère Bac' },
        { name: '2eme Bac', nameAr: 'السنة الثانية باكالوريا', nameFr: '2ème Bac' },
      ],
    },
    {
      name: 'SVT', nameAr: 'علوم الحياة والأرض', nameFr: 'Sciences de la Vie et de la Terre',
      levels: [
        { name: '3eme Année Collège', nameAr: 'السنة الثالثة إعدادي', nameFr: "3ème Année Collège" },
        { name: '2eme Bac', nameAr: 'السنة الثانية باكالوريا', nameFr: '2ème Bac' },
      ],
    },
    {
      name: 'Français', nameAr: 'اللغة الفرنسية', nameFr: 'Français',
      levels: [
        { name: '3eme Année Collège', nameAr: 'السنة الثالثة إعدادي', nameFr: "3ème Année Collège" },
        { name: 'Tronc Commun', nameAr: 'الجذع المشترك', nameFr: 'Tronc Commun' },
        { name: '1er Bac', nameAr: 'السنة أولى باكالوريا', nameFr: '1ère Bac' },
      ],
    },
    {
      name: 'SI', nameAr: 'العلوم الهندسية', nameFr: "Sciences de l'Ingénieur",
      levels: [
        { name: 'Tronc Commun', nameAr: 'الجذع المشترك', nameFr: 'Tronc Commun' },
        { name: '1er Bac', nameAr: 'السنة أولى باكالوريا', nameFr: '1ère Bac' },
        { name: '2eme Bac', nameAr: 'السنة الثانية باكالوريا', nameFr: '2ème Bac' },
      ],
    },
    {
      name: 'Philo', nameAr: 'الفلسفة', nameFr: 'Philosophie',
      levels: [
        { name: '2eme Bac', nameAr: 'السنة الثانية باكالوريا', nameFr: '2ème Bac' },
      ],
    },
    {
      name: 'Anglais', nameAr: 'اللغة الإنجليزية', nameFr: 'Anglais',
      levels: [
        { name: '2eme Bac', nameAr: 'السنة الثانية باكالوريا', nameFr: '2ème Bac' },
      ],
    },
  ];

  let soutienSubjectCount = 0;
  for (let i = 0; i < soutienSubjects.length; i++) {
    const sub = soutienSubjects[i];
    const subject = await db.subject.upsert({
      where: { id: `soutien_${sub.name.toLowerCase()}` },
      update: {},
      create: {
        id: `soutien_${sub.name.toLowerCase()}`,
        name: sub.name,
        nameAr: sub.nameAr,
        nameFr: sub.nameFr,
        serviceId: soutienService.id,
        order: i + 1,
      },
    });

    for (let j = 0; j < sub.levels.length; j++) {
      const lvl = sub.levels[j];
      await db.level.upsert({
        where: { id: `soutien_${sub.name.toLowerCase()}_${lvl.name.toLowerCase().replace(/\s+/g, '_')}` },
        update: {},
        create: {
          id: `soutien_${sub.name.toLowerCase()}_${lvl.name.toLowerCase().replace(/\s+/g, '_')}`,
          name: lvl.name,
          nameAr: lvl.nameAr,
          nameFr: lvl.nameFr,
          subjectId: subject.id,
          order: j + 1,
        },
      });
    }
    soutienSubjectCount++;
  }
  console.log(`  ✅ ${soutienSubjectCount} subjects with levels seeded\n`);

  // ==========================================
  // 4. SERVICE 2: Langues
  // ==========================================
  console.log('🌐 Seeding Service: Langues...');

  const languesService = await db.service.upsert({
    where: { id: 'service_langues' },
    update: {},
    create: {
      id: 'service_langues',
      name: 'Langues',
      nameAr: 'اللغات',
      nameFr: 'Langues',
      icon: 'Languages',
      order: 2,
    },
  });

  const languesLevels = [
    { name: 'A1', nameAr: 'A1', nameFr: 'A1' },
    { name: 'A2', nameAr: 'A2', nameFr: 'A2' },
    { name: 'B1', nameAr: 'B1', nameFr: 'B1' },
    { name: 'B2', nameAr: 'B2', nameFr: 'B2' },
    { name: 'C1', nameAr: 'C1', nameFr: 'C1' },
    { name: 'C2', nameAr: 'C2', nameFr: 'C2' },
  ];

  const languesSubjects: { name: string; nameAr: string; nameFr: string }[] = [
    // Formations
    { name: 'Français', nameAr: 'اللغة الفرنسية', nameFr: 'Français' },
    { name: 'Anglais', nameAr: 'اللغة الإنجليزية', nameFr: 'Anglais' },
    { name: 'Allemand', nameAr: 'اللغة الألمانية', nameFr: 'Allemand' },
    { name: 'Espagnol', nameAr: 'اللغة الإسبانية', nameFr: 'Espagnol' },
    // FR Test preparations
    { name: 'TCF', nameAr: 'TCF', nameFr: 'TCF' },
    { name: 'TEF', nameAr: 'TEF', nameFr: 'TEF' },
    { name: 'DELF', nameAr: 'DELF', nameFr: 'DELF' },
    { name: 'DALF', nameAr: 'DALF', nameFr: 'DALF' },
    // AN Test preparations
    { name: 'IELTS', nameAr: 'IELTS', nameFr: 'IELTS' },
    { name: 'TOEFL', nameAr: 'TOEFL', nameFr: 'TOEFL' },
    // ES Test preparations
    { name: 'DELE', nameAr: 'DELE', nameFr: 'DELE' },
    // DE Test preparations
    { name: 'Goethe', nameAr: 'Goethe', nameFr: 'Goethe' },
    { name: 'ÖSD', nameAr: 'ÖSD', nameFr: 'ÖSD' },
    { name: 'TELC', nameAr: 'TELC', nameFr: 'TELC' },
  ];

  let languesSubjectCount = 0;
  for (let i = 0; i < languesSubjects.length; i++) {
    const sub = languesSubjects[i];
    const subject = await db.subject.upsert({
      where: { id: `lang_${sub.name.toLowerCase()}` },
      update: {},
      create: {
        id: `lang_${sub.name.toLowerCase()}`,
        name: sub.name,
        nameAr: sub.nameAr,
        nameFr: sub.nameFr,
        serviceId: languesService.id,
        order: i + 1,
      },
    });

    for (let j = 0; j < languesLevels.length; j++) {
      const lvl = languesLevels[j];
      await db.level.upsert({
        where: { id: `lang_${sub.name.toLowerCase()}_${lvl.name.toLowerCase()}` },
        update: {},
        create: {
          id: `lang_${sub.name.toLowerCase()}_${lvl.name.toLowerCase()}`,
          name: lvl.name,
          nameAr: lvl.nameAr,
          nameFr: lvl.nameFr,
          subjectId: subject.id,
          order: j + 1,
        },
      });
    }
    languesSubjectCount++;
  }
  console.log(`  ✅ ${languesSubjectCount} subjects with ${languesLevels.length} levels each seeded\n`);

  // ==========================================
  // 5. SERVICE 3: IT
  // ==========================================
  console.log('💻 Seeding Service: IT...');

  const itService = await db.service.upsert({
    where: { id: 'service_it' },
    update: {},
    create: {
      id: 'service_it',
      name: 'IT',
      nameAr: 'تكنولوجيا المعلومات',
      nameFr: 'Informatique',
      icon: 'Monitor',
      order: 3,
    },
  });

  const itLevels = [
    { name: 'Débutant', nameAr: 'مبتدئ', nameFr: 'Débutant' },
    { name: 'Intermédiaire', nameAr: 'متوسط', nameFr: 'Intermédiaire' },
    { name: 'Avancé', nameAr: 'متقدم', nameFr: 'Avancé' },
  ];

  const itSubjects: { name: string; nameAr: string; nameFr: string }[] = [
    { name: 'Bureautique', nameAr: 'الإعلام الآلي', nameFr: 'Bureautique' },
    { name: 'Dev Web', nameAr: 'تطوير الويب', nameFr: 'Développement Web' },
    { name: 'Dev Mobile', nameAr: 'تطوير الهاتف المحمول', nameFr: 'Développement Mobile' },
    { name: 'AI', nameAr: 'الذكاء الاصطناعي', nameFr: 'Intelligence Artificielle' },
    { name: 'Cybersécurité', nameAr: 'الأمن السيبراني', nameFr: 'Cybersécurité' },
  ];

  let itSubjectCount = 0;
  for (let i = 0; i < itSubjects.length; i++) {
    const sub = itSubjects[i];
    const subject = await db.subject.upsert({
      where: { id: `it_${sub.name.toLowerCase().replace(/\s+/g, '_')}` },
      update: {},
      create: {
        id: `it_${sub.name.toLowerCase().replace(/\s+/g, '_')}`,
        name: sub.name,
        nameAr: sub.nameAr,
        nameFr: sub.nameFr,
        serviceId: itService.id,
        order: i + 1,
      },
    });

    for (let j = 0; j < itLevels.length; j++) {
      const lvl = itLevels[j];
      await db.level.upsert({
        where: { id: `it_${sub.name.toLowerCase().replace(/\s+/g, '_')}_${lvl.name.toLowerCase().replace(/\s+/g, '_')}` },
        update: {},
        create: {
          id: `it_${sub.name.toLowerCase().replace(/\s+/g, '_')}_${lvl.name.toLowerCase().replace(/\s+/g, '_')}`,
          name: lvl.name,
          nameAr: lvl.nameAr,
          nameFr: lvl.nameFr,
          subjectId: subject.id,
          order: j + 1,
        },
      });
    }
    itSubjectCount++;
  }
  console.log(`  ✅ ${itSubjectCount} subjects with ${itLevels.length} levels each seeded\n`);

  // ==========================================
  // 6. SERVICE 4: Préparation Concours
  // ==========================================
  console.log('🏆 Seeding Service: Préparation Concours...');

  const concoursService = await db.service.upsert({
    where: { id: 'service_concours' },
    update: {},
    create: {
      id: 'service_concours',
      name: 'Préparation Concours',
      nameAr: 'تحضير المسابقات',
      nameFr: 'Préparation aux Concours',
      icon: 'Trophy',
      order: 4,
    },
  });

  const concoursSubjects: { name: string; nameAr: string; nameFr: string }[] = [
    // ÉCOLES D'INGÉNIEURS
    { name: 'ENSA', nameAr: 'ENSA', nameFr: 'ENSA' },
    { name: 'ENSAM', nameAr: 'ENSAM', nameFr: 'ENSAM' },
    { name: 'ENA', nameAr: 'ENA', nameFr: 'ENA' },
    { name: 'EMI', nameAr: 'EMI', nameFr: 'EMI' },
    { name: 'EHTP', nameAr: 'EHTP', nameFr: 'EHTP' },
    { name: 'INPT', nameAr: 'INPT', nameFr: 'INPT' },
    { name: 'ENSIAS', nameAr: 'ENSIAS', nameFr: 'ENSIAS' },
    { name: 'Mines Rabat', nameAr: 'Mines Rabat', nameFr: 'Mines Rabat' },
    { name: 'IAV', nameAr: 'IAV', nameFr: 'IAV' },
    { name: 'Institut des Mines de Marrakech', nameAr: 'معهد المناجم مراكش', nameFr: 'Institut des Mines de Marrakech' },
    // ÉCOLES DE COMMERCE
    { name: 'ENCG', nameAr: 'ENCG', nameFr: 'ENCG' },
    // SANTÉ
    { name: 'FMP', nameAr: 'FMP', nameFr: 'FMP' },
    { name: 'FMD', nameAr: 'FMD', nameFr: 'FMD' },
    { name: 'ISPITS', nameAr: 'ISPITS', nameFr: 'ISPITS' },
    // ÉDUCATION ET FORMATION
    { name: 'ESEF', nameAr: 'ESEF', nameFr: 'ESEF' },
    { name: 'ENS', nameAr: 'ENS', nameFr: 'ENS' },
    // TECHNOLOGIE
    { name: 'EST', nameAr: 'EST', nameFr: 'EST' },
    { name: 'IFTSAU', nameAr: 'IFTSAU', nameFr: 'IFTSAU' },
    // ARTS ET CULTURE
    { name: 'ENSAD', nameAr: 'ENSAD', nameFr: 'ENSAD' },
    { name: 'ISADAC', nameAr: 'ISADAC', nameFr: 'ISADAC' },
    { name: 'INSMAC', nameAr: 'INSMAC', nameFr: 'INSMAC' },
    { name: 'INAC', nameAr: 'INAC', nameFr: 'INAC' },
    // SPORT
    { name: 'ISS', nameAr: 'ISS', nameFr: 'ISS' },
    { name: 'ISSS', nameAr: 'ISSS', nameFr: 'ISSS' },
    // TRAVAIL SOCIAL
    { name: 'INAS', nameAr: 'INAS', nameFr: 'INAS' },
    // CLASSES PRÉPARATOIRES
    { name: 'CPGE MP', nameAr: 'CPGE MP', nameFr: 'CPGE MP' },
    { name: 'CPGE PSI', nameAr: 'CPGE PSI', nameFr: 'CPGE PSI' },
    { name: 'CPGE TSI', nameAr: 'CPGE TSI', nameFr: 'CPGE TSI' },
    { name: 'CPGE ECS', nameAr: 'CPGE ECS', nameFr: 'CPGE ECS' },
    { name: 'CPGE LSH', nameAr: 'CPGE LSH', nameFr: 'CPGE LSH' },
    { name: 'CPGE BCPST', nameAr: 'CPGE BCPST', nameFr: 'CPGE BCPST' },
  ];

  let concoursSubjectCount = 0;
  for (let i = 0; i < concoursSubjects.length; i++) {
    const sub = concoursSubjects[i];
    const subject = await db.subject.upsert({
      where: { id: `concours_${sub.name.toLowerCase().replace(/\s+/g, '_')}` },
      update: {},
      create: {
        id: `concours_${sub.name.toLowerCase().replace(/\s+/g, '_')}`,
        name: sub.name,
        nameAr: sub.nameAr,
        nameFr: sub.nameFr,
        serviceId: concoursService.id,
        order: i + 1,
      },
    });

    // Each concours has a single "Préparation" level
    await db.level.upsert({
      where: { id: `concours_${sub.name.toLowerCase().replace(/\s+/g, '_')}_preparation` },
      update: {},
      create: {
        id: `concours_${sub.name.toLowerCase().replace(/\s+/g, '_')}_preparation`,
        name: 'Préparation',
        nameAr: 'تحضير',
        nameFr: 'Préparation',
        subjectId: subject.id,
        order: 1,
      },
    });
    concoursSubjectCount++;
  }
  console.log(`  ✅ ${concoursSubjectCount} concours subjects with Préparation level seeded\n`);

  // ==========================================
  // SUMMARY
  // ==========================================
  const totalServices = await db.service.count();
  const totalSubjects = await db.subject.count();
  const totalLevels = await db.level.count();
  const totalSettings = await db.setting.count();
  const totalClassrooms = await db.classroom.count();

  console.log('═══════════════════════════════════════');
  console.log('🎉 Seed completed successfully!');
  console.log('═══════════════════════════════════════');
  console.log(`  Settings:    ${totalSettings}`);
  console.log(`  Classrooms:  ${totalClassrooms}`);
  console.log(`  Services:    ${totalServices}`);
  console.log(`  Subjects:    ${totalSubjects}`);
  console.log(`  Levels:      ${totalLevels}`);
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
