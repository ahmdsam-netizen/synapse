import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/database.js';
import { redis } from '../src/config/redis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Diverse realistic names for generating students
const FIRST_NAMES_MALE = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishan',
  'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Aryan', 'Dhruv', 'Kabir', 'Ritvik', 'Darsh',
  'Yash', 'Karan', 'Nikhil', 'Rahul', 'Siddharth', 'Varun', 'Rohit', 'Kunal', 'Sameer', 'Dev',
  'Rohan', 'Vikram', 'Manish', 'Harsh', 'Ankit', 'Gaurav', 'Abhishek', 'Akash', 'Mayank', 'Tanmay',
  'Kartik', 'Saurabh', 'Amit', 'Deepak', 'Naveen', 'Chirag', 'Tushar', 'Rishabh', 'Shubham', 'Vikas'
];

const FIRST_NAMES_FEMALE = [
  'Ananya', 'Diya', 'Saanvi', 'Sara', 'Myra', 'Pari', 'Aadhya', 'Kiara', 'Ira', 'Riya',
  'Prisha', 'Anvi', 'Anika', 'Navya', 'Samaira', 'Siya', 'Amyra', 'Avni', 'Tanvi', 'Pooja',
  'Neha', 'Sneha', 'Shreya', 'Divya', 'Meera', 'Ritu', 'Swati', 'Deepa', 'Bhavna', 'Priya',
  'Ishita', 'Kritika', 'Nandini', 'Rupal', 'Simran', 'Tanushree', 'Aayushi', 'Shruti', 'Anushka', 'Rashi',
  'Saloni', 'Pallavi', 'Aditi', 'Harshita', 'Kavya', 'Tarini', 'Radhika', 'Trisha', 'Charu', 'Juhi'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Mehta', 'Iyer', 'Reddy', 'Malhotra', 'Sen', 'Gupta', 'Khan',
  'Rao', 'Nair', 'Joshi', 'Bhat', 'Deshmukh', 'Kulkarni', 'Mukherjee', 'Chatterjee', 'Banerjee', 'Bose',
  'Agarwal', 'Singhal', 'Mittal', 'Bansal', 'Goyal', 'Jain', 'Shah', 'Chauhan', 'Singh', 'Kumar',
  'Das', 'Ghosh', 'Menon', 'Pillai', 'Nambiar', 'Hegde', 'Shetty', 'Pai', 'Kamath', 'Shenoy',
  'Mishra', 'Pandey', 'Trivedi', 'Saxena', 'Dubey', 'Chopra', 'Kapoor', 'Bhatia', 'Malik', 'Dutta'
];

const BRANCHES = [
  'Computer Science & Engineering',
  'Electrical Engineering',
  'Electronics & Communication',
  'Information Technology',
  'Data Science & Artificial Intelligence',
  'Mechanical Engineering',
  'Design & Interaction',
  'Mathematics & Computing',
  'Chemical Engineering',
  'Biotechnology'
];

const AVATAR_URLS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400',
  'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400',
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400',
  'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=400'
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomSubarray<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('--- Starting Scaled Seed Script (~1000 Users, ~100 Boards) ---');

    // 1. Seed Taxonomy
    const seedFile = path.join(__dirname, '..', 'src', 'db', 'seed.sql');
    const sql = fs.readFileSync(seedFile, 'utf-8');
    await client.query(sql);
    console.log('✓ Taxonomy loaded');

    // Check if database is already seeded
    const userCountRes = await client.query('SELECT count(*) FROM users');
    const existingCount = parseInt(userCountRes.rows[0].count, 10);
    if (existingCount > 0 && process.env.FORCE_SEED !== 'true') {
      console.log(`✓ Database already seeded with ${existingCount} users. Skipping truncation & re-seed to preserve user sessions.`);
      return;
    }

    // Clean existing data for a fresh, clean graph
    console.log('Cleaning existing relations...');
    await client.query(`
      TRUNCATE TABLE join_requests, board_postings, group_members, groups, 
                     recommendations, connection_edges, connections, work_items, 
                     user_interests, user_skills, refresh_tokens, user_blocks, users CASCADE;
    `);

    // Fetch taxonomy maps
    const collegesRes = await client.query('SELECT id, email_domain, name FROM colleges');
    const colleges = collegesRes.rows;
    const collegeMap = new Map<string, string>(colleges.map((r: any) => [r.email_domain, r.id]));
    const iitbCollegeId = collegeMap.get('iitb.ac.in') || colleges[0].id;

    const skillsRes = await client.query('SELECT id, name FROM skills');
    const skillsList = skillsRes.rows;
    const skillMap = new Map<string, string>(skillsList.map((r: any) => [r.name, r.id]));

    const interestsRes = await client.query('SELECT id, name FROM interests');
    const interestsList = interestsRes.rows;
    const interestMap = new Map<string, string>(interestsList.map((r: any) => [r.name, r.id]));

    // Reusable single password hash
    console.log('Hashing default password (Password123!)...');
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 2. Prepare Users Data (1000 users)
    console.log('Generating 1000 user profiles...');
    const usersToInsert: any[] = [];

    // User 0: Alex Sharma (Primary Demo User)
    usersToInsert.push({
      email: 'alex@iitb.ac.in',
      name: 'Alex Sharma',
      college_id: iitbCollegeId,
      year_of_study: 3,
      branch: 'Computer Science & Engineering',
      looking_for: 'both',
      bio: 'Full-stack engineer passionate about distributed systems, microservices, and AI-driven collaborative apps. Always looking for hackathon teammates!',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      skills: [
        { name: 'React.js', prof: 'advanced' },
        { name: 'Node.js', prof: 'advanced' },
        { name: 'TypeScript', prof: 'advanced' },
        { name: 'PostgreSQL', prof: 'intermediate' },
        { name: 'Docker', prof: 'intermediate' },
      ],
      interests: ['Artificial Intelligence', 'Hackathons', 'Open Source Contributing', 'Cloud Computing'],
      workItems: [
        {
          title: 'Campus Connect Platform',
          description: 'A skill-based student discovery and real-time collaboration tool built with React, Node.js, and Redis.',
          tech_used: ['React', 'TypeScript', 'Node.js', 'Redis', 'PostgreSQL'],
          repo_url: 'https://github.com/alex/campus-connect',
          live_url: 'https://campusconnect.dev',
        },
        {
          title: 'AI Study Assistant',
          description: 'Automated lecture summarizer and flashcard generator using open-source LLMs and vector search.',
          tech_used: ['Python', 'FastAPI', 'PyTorch', 'LangChain'],
          repo_url: 'https://github.com/alex/ai-study-assistant',
        }
      ]
    });

    // Specific Core Network (Users 1 - 15) connected directly to Alex
    const coreFriends = [
      { name: 'Priya Patel', email: 'priya@iitb.ac.in', domain: 'iitb.ac.in', skills: ['UI Design', 'UX Design', 'Figma', 'React.js', 'Tailwind CSS'], interests: ['Digital Art', 'Hackathons', 'Startup Building'], branch: 'Design & Interaction' },
      { name: 'Sneha Reddy', email: 'sneha@bits-pilani.ac.in', domain: 'bits-pilani.ac.in', skills: ['Flutter', 'React Native', 'Dart', 'Firebase', 'UI Design'], interests: ['Mobile Development', 'Entrepreneurship', 'Product Management'], branch: 'Information Technology' },
      { name: 'Rohan Mehta', email: 'rohan@iitb.ac.in', domain: 'iitb.ac.in', skills: ['Machine Learning', 'Deep Learning', 'Python', 'PyTorch', 'C++'], interests: ['Artificial Intelligence', 'Robotics', 'Research'], branch: 'Electrical Engineering' },
      { name: 'Ananya Iyer', email: 'ananya@iitb.ac.in', domain: 'iitb.ac.in', skills: ['C++', 'Python', 'Go', 'Redis', 'PostgreSQL'], interests: ['Competitive Programming', 'Cloud Computing', 'Mathematics'], branch: 'Computer Science & Engineering' },
      { name: 'Kabir Verma', email: 'kabir@iitd.ac.in', domain: 'iitd.ac.in', skills: ['React.js', 'Node.js', 'TypeScript', 'Docker', 'AWS'], interests: ['Cloud Computing', 'Open Source Contributing', 'Hackathons'], branch: 'Computer Science & Engineering' },
      { name: 'Vikram Malhotra', email: 'vikram@dtu.ac.in', domain: 'dtu.ac.in', skills: ['Python', 'FastAPI', 'Kubernetes', 'Docker', 'Linux'], interests: ['Cybersecurity', 'Cloud Computing', 'Internet of Things'], branch: 'Information Technology' },
      { name: 'Neha Sen', email: 'neha@vit.ac.in', domain: 'vit.ac.in', skills: ['UI Design', 'Figma', 'HTML5', 'CSS3', 'React.js'], interests: ['Design', 'Startup Building', 'Content Creation'], branch: 'Design & Interaction' },
      { name: 'Dev Gupta', email: 'dev@iitm.ac.in', domain: 'iitm.ac.in', skills: ['React.js', 'TypeScript', 'Next.js', 'Tailwind CSS', 'GraphQL'], interests: ['Artificial Intelligence', 'Web Development', 'Hackathons'], branch: 'Computer Science & Engineering' },
      { name: 'Aisha Khan', email: 'aisha@nitt.edu', domain: 'nitt.edu', skills: ['Python', 'Pandas', 'NumPy', 'Data Analysis', 'PostgreSQL'], interests: ['Data Science & AI', 'Research', 'Economics'], branch: 'Data Science & Artificial Intelligence' },
      { name: 'Manish Rao', email: 'manish@iiit.ac.in', domain: 'iiit.ac.in', skills: ['Java', 'Spring Boot', 'Microservices', 'Docker', 'MySQL'], interests: ['Competitive Programming', 'Open Source Contributing'], branch: 'Computer Science & Engineering' },
      { name: 'Tanvi Joshi', email: 'tanvi@iitb.ac.in', domain: 'iitb.ac.in', skills: ['React.js', 'Node.js', 'PostgreSQL', 'JavaScript', 'Tailwind CSS'], interests: ['Hackathons', 'Artificial Intelligence', 'Startup Building'], branch: 'Computer Science & Engineering' },
      { name: 'Aryan Deshmukh', email: 'aryan@iitb.ac.in', domain: 'iitb.ac.in', skills: ['Machine Learning', 'TensorFlow', 'Python', 'Docker'], interests: ['Robotics', 'Artificial Intelligence', 'Research'], branch: 'Electrical Engineering' },
      { name: 'Diya Bhat', email: 'diya@gmail.com', domain: 'gmail.com', skills: ['Product Management', 'Leadership', 'UI Design', 'Figma'], interests: ['Startup Building', 'Product Management', 'Marketing'], branch: 'Design & Interaction' },
      { name: 'Karan Mittal', email: 'karan@bits-pilani.ac.in', domain: 'bits-pilani.ac.in', skills: ['Rust', 'C++', 'Go', 'Linux', 'Docker'], interests: ['Blockchain', 'Open Source Contributing', 'Cloud Computing'], branch: 'Computer Science & Engineering' },
      { name: 'Pooja Nair', email: 'pooja@iitd.ac.in', domain: 'iitd.ac.in', skills: ['TypeScript', 'React.js', 'GraphQL', 'Node.js'], interests: ['Hackathons', 'Web Development', 'Digital Art'], branch: 'Information Technology' }
    ];

    for (const f of coreFriends) {
      const collegeId = collegeMap.get(f.domain) || iitbCollegeId;
      usersToInsert.push({
        email: f.email,
        name: f.name,
        college_id: collegeId,
        year_of_study: Math.floor(Math.random() * 4) + 1,
        branch: f.branch,
        looking_for: getRandomItem(['project', 'event', 'both']),
        bio: `Enthusiastic ${f.branch} student passionate about tech, open source, and team collaborations.`,
        avatar_url: getRandomItem(AVATAR_URLS),
        skills: f.skills.map(s => ({ name: s, prof: getRandomItem(['intermediate', 'advanced']) })),
        interests: f.interests,
        workItems: [
          {
            title: `${f.name}'s Featured Project`,
            description: `Collaborative project focusing on ${f.skills[0]} and practical collegiate workflows.`,
            tech_used: f.skills.slice(0, 3),
            repo_url: `https://github.com/${f.name.toLowerCase().replace(' ', '')}/project`
          }
        ]
      });
    }

    // Generate remaining ~984 users (total = 1000)
    const usedEmails = new Set<string>(usersToInsert.map(u => u.email));
    while (usersToInsert.length < 1000) {
      const isFemale = Math.random() > 0.5;
      const firstName = isFemale ? getRandomItem(FIRST_NAMES_FEMALE) : getRandomItem(FIRST_NAMES_MALE);
      const lastName = getRandomItem(LAST_NAMES);
      const college = getRandomItem(colleges);
      const emailDomain = college.email_domain;
      const cleanName = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 900 + 100)}`;
      const email = `${cleanName}@${emailDomain}`;

      if (usedEmails.has(email)) continue;
      usedEmails.add(email);

      // Assign 3-6 random skills
      const selectedSkills = getRandomSubarray(skillsList, Math.floor(Math.random() * 4) + 3).map((s: any) => ({
        name: s.name,
        prof: getRandomItem(['beginner', 'intermediate', 'advanced'])
      }));

      // Assign 2-5 random interests
      const selectedInterests = getRandomSubarray(interestsList, Math.floor(Math.random() * 4) + 2).map((i: any) => i.name);

      const branch = getRandomItem(BRANCHES);

      usersToInsert.push({
        email,
        name: `${firstName} ${lastName}`,
        college_id: college.id,
        year_of_study: Math.floor(Math.random() * 4) + 1,
        branch,
        looking_for: getRandomItem(['project', 'event', 'both', 'none']),
        bio: `Passionate about ${selectedSkills[0]?.name || 'Technology'} and ${selectedInterests[0] || 'Learning'}. Excited to build real-world systems.`,
        avatar_url: getRandomItem(AVATAR_URLS),
        skills: selectedSkills,
        interests: selectedInterests,
        workItems: Math.random() > 0.3 ? [
          {
            title: `${selectedSkills[0]?.name || 'Software'} Automation Tool`,
            description: `Built an interactive application exploring modern ${selectedInterests[0] || 'development'} patterns.`,
            tech_used: selectedSkills.slice(0, 3).map(s => s.name),
            repo_url: `https://github.com/${cleanName}/portfolio-project`
          }
        ] : []
      });
    }

    // 3. Batch Insert Users
    console.log(`Inserting ${usersToInsert.length} users into database...`);
    const insertedUsers: any[] = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < usersToInsert.length; i += BATCH_SIZE) {
      const chunk = usersToInsert.slice(i, i + BATCH_SIZE);
      const values: any[] = [];
      const placeholders: string[] = [];

      chunk.forEach((u, idx) => {
        const offset = idx * 10;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
        values.push(u.email, passwordHash, u.name, u.college_id, u.year_of_study, u.branch, u.looking_for, u.bio, u.avatar_url, 100);
      });

      const res = await client.query(
        `INSERT INTO users (email, password_hash, name, college_id, year_of_study, branch, looking_for, bio, avatar_url, profile_completeness)
         VALUES ${placeholders.join(', ')}
         RETURNING id, email`,
        values
      );
      insertedUsers.push(...res.rows);
    }

    console.log(`✓ Inserted ${insertedUsers.length} users`);

    const userEmailToId = new Map<string, string>(insertedUsers.map(u => [u.email, u.id]));
    const alexId = userEmailToId.get('alex@iitb.ac.in')!;

    // 4. Batch Insert User Skills, Interests, and Work Items
    console.log('Inserting skills, interests, and work items...');
    const userSkillsToInsert: any[] = [];
    const userInterestsToInsert: any[] = [];
    const workItemsToInsert: any[] = [];

    usersToInsert.forEach(u => {
      const uid = userEmailToId.get(u.email);
      if (!uid) return;

      u.skills.forEach((s: any) => {
        const sid = skillMap.get(s.name);
        if (sid) userSkillsToInsert.push({ userId: uid, skillId: sid, prof: s.prof });
      });

      u.interests.forEach((interestName: string) => {
        const iid = interestMap.get(interestName);
        if (iid) userInterestsToInsert.push({ userId: uid, interestId: iid });
      });

      (u.workItems || []).forEach((w: any) => {
        workItemsToInsert.push({
          userId: uid,
          title: w.title,
          description: w.description,
          tech_used: w.tech_used,
          repo_url: w.repo_url,
          live_url: w.live_url || null
        });
      });
    });

    // Chunk insert user_skills
    for (let i = 0; i < userSkillsToInsert.length; i += 200) {
      const chunk = userSkillsToInsert.slice(i, i + 200);
      const values: any[] = [];
      const placeholders: string[] = [];
      chunk.forEach((us, idx) => {
        const offset = idx * 3;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        values.push(us.userId, us.skillId, us.prof);
      });
      await client.query(`INSERT INTO user_skills (user_id, skill_id, proficiency) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`, values);
    }
    console.log(`✓ Inserted ${userSkillsToInsert.length} user skills`);

    // Chunk insert user_interests
    for (let i = 0; i < userInterestsToInsert.length; i += 200) {
      const chunk = userInterestsToInsert.slice(i, i + 200);
      const values: any[] = [];
      const placeholders: string[] = [];
      chunk.forEach((ui, idx) => {
        const offset = idx * 2;
        placeholders.push(`($${offset + 1}, $${offset + 2})`);
        values.push(ui.userId, ui.interestId);
      });
      await client.query(`INSERT INTO user_interests (user_id, interest_id) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`, values);
    }
    console.log(`✓ Inserted ${userInterestsToInsert.length} user interests`);

    // Chunk insert work_items
    for (let i = 0; i < workItemsToInsert.length; i += 100) {
      const chunk = workItemsToInsert.slice(i, i + 100);
      const values: any[] = [];
      const placeholders: string[] = [];
      chunk.forEach((w, idx) => {
        const offset = idx * 6;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
        values.push(w.userId, w.title, w.description, w.tech_used, w.repo_url, w.live_url);
      });
      await client.query(`INSERT INTO work_items (user_id, title, description, tech_used, repo_url, live_url) VALUES ${placeholders.join(', ')}`, values);
    }
    console.log(`✓ Inserted ${workItemsToInsert.length} work items`);

    // 5. Build Rich Connection Graph
    console.log('Building connection graph (1st degree, 2nd degree, and network clusters)...');
    const connectionsToInsert: any[] = [];
    const connectionEdgesToInsert: any[] = [];

    // Alex's direct 1st-degree friends (Users 1 - 15)
    const alexDirectFriendIds: string[] = [];
    for (let i = 1; i <= 15; i++) {
      const friendId = insertedUsers[i].id;
      alexDirectFriendIds.push(friendId);
      connectionsToInsert.push({ requesterId: alexId, receiverId: friendId, status: 'accepted' });
      connectionEdgesToInsert.push({ u1: alexId, u2: friendId });
      connectionEdgesToInsert.push({ u1: friendId, u2: alexId });
    }

    // 2nd-degree connections:
    // Connect each of Alex's 15 direct friends to ~10 unique other students (Users 16 - 165)
    let userIndex = 16;
    const secondDegreeUserIds: string[] = [];
    for (const directFriendId of alexDirectFriendIds) {
      for (let j = 0; j < 8 && userIndex < insertedUsers.length; j++) {
        const candidateId = insertedUsers[userIndex].id;
        secondDegreeUserIds.push(candidateId);
        connectionsToInsert.push({ requesterId: directFriendId, receiverId: candidateId, status: 'accepted' });
        connectionEdgesToInsert.push({ u1: directFriendId, u2: candidateId });
        connectionEdgesToInsert.push({ u1: candidateId, u2: directFriendId });
        userIndex++;
      }
    }

    // Make some candidates connect to MULTIPLE direct friends so they have 2 or 3 mutual connections with Alex!
    for (let k = 0; k < 10; k++) {
      const multiMutualCandidate = secondDegreeUserIds[k];
      const otherFriend = alexDirectFriendIds[(k + 3) % alexDirectFriendIds.length];
      connectionsToInsert.push({ requesterId: otherFriend, receiverId: multiMutualCandidate, status: 'accepted' });
      connectionEdgesToInsert.push({ u1: otherFriend, u2: multiMutualCandidate });
      connectionEdgesToInsert.push({ u1: multiMutualCandidate, u2: otherFriend });
    }

    // Incoming pending connection requests to Alex (Users 170 - 175)
    for (let p = 170; p < 175 && p < insertedUsers.length; p++) {
      connectionsToInsert.push({ requesterId: insertedUsers[p].id, receiverId: alexId, status: 'pending' });
    }

    // Interconnect other students to form clusters
    for (let c = 200; c < 600; c += 4) {
      if (c + 3 < insertedUsers.length) {
        const uA = insertedUsers[c].id;
        const uB = insertedUsers[c + 1].id;
        const uC = insertedUsers[c + 2].id;
        connectionsToInsert.push({ requesterId: uA, receiverId: uB, status: 'accepted' });
        connectionsToInsert.push({ requesterId: uB, receiverId: uC, status: 'accepted' });
        connectionEdgesToInsert.push({ u1: uA, u2: uB }, { u1: uB, u2: uA }, { u1: uB, u2: uC }, { u1: uC, u2: uB });
      }
    }

    // Insert connections
    for (let i = 0; i < connectionsToInsert.length; i += 100) {
      const chunk = connectionsToInsert.slice(i, i + 100);
      const values: any[] = [];
      const placeholders: string[] = [];
      chunk.forEach((c, idx) => {
        const offset = idx * 3;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        values.push(c.requesterId, c.receiverId, c.status);
      });
      await client.query(`INSERT INTO connections (requester_id, receiver_id, status) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`, values);
    }

    // Insert connection edges
    for (let i = 0; i < connectionEdgesToInsert.length; i += 200) {
      const chunk = connectionEdgesToInsert.slice(i, i + 200);
      const values: any[] = [];
      const placeholders: string[] = [];
      chunk.forEach((e, idx) => {
        const offset = idx * 2;
        placeholders.push(`($${offset + 1}, $${offset + 2})`);
        values.push(e.u1, e.u2);
      });
      await client.query(`INSERT INTO connection_edges (user_id, friend_id) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`, values);
    }
    console.log(`✓ Seeded ${connectionsToInsert.length} connections & ${connectionEdgesToInsert.length} graph edges`);

    // 6. Seed Groups (~50 groups) & Board Postings (~100 postings)
    console.log('Generating ~50 Groups and ~100 Board Postings (with 30 matched to Alex)...');

    const reactSkillId = skillMap.get('React.js')!;
    const nodeSkillId = skillMap.get('Node.js')!;
    const tsSkillId = skillMap.get('TypeScript')!;
    const pgSkillId = skillMap.get('PostgreSQL')!;
    const dockerSkillId = skillMap.get('Docker')!;
    const aiInterestId = interestMap.get('Artificial Intelligence')!;
    const hackathonInterestId = interestMap.get('Hackathons')!;
    const openSourceInterestId = interestMap.get('Open Source Contributing')!;
    const cloudInterestId = interestMap.get('Cloud Computing')!;

    const createdGroups: any[] = [];
    const GROUP_TEMPLATES = [
      { name: 'Full-Stack Web Innovators', desc: 'Building scalable modern web apps using reactive frontends and cloud microservices.' },
      { name: 'AI & Autonomous Agents Lab', desc: 'Experimenting with multi-agent orchestration, tool use, and LLM fine-tuning.' },
      { name: 'Smart Campus IoT Systems', desc: 'Hardware-software integration for real-time campus energy and occupancy tracking.' },
      { name: 'Collegiate Hackathon Titans', desc: 'Competitive hackathon squad targeting global collegiate hackathons and builder sprints.' },
      { name: 'Autonomous Drone & Rover Team', desc: 'Designing computer vision navigation pipelines and embedded control for robotics.' },
      { name: 'Cloud Infrastructure & DevOps Guild', desc: 'Deploying high-availability Kubernetes clusters, CI/CD pipelines, and observability.' },
      { name: 'Cross-Platform Mobile Studio', desc: 'Building sleek mobile apps with Flutter and React Native for thousands of students.' },
      { name: 'Decentralized Systems & Web3 Collective', desc: 'Smart contracts, zero-knowledge proofs, and decentralized storage applications.' },
      { name: 'Algorithmic Trading & FinTech Lab', desc: 'Quantitative finance, high-throughput market data processing, and backtesting engines.' },
      { name: 'UI/UX Design Systems Workshop', desc: 'Crafting accessible, human-centric design libraries, Figma tokens, and micro-interactions.' },
      { name: 'Open-Source Developer Ecosystem', desc: 'Collaborating on high-impact GitHub open-source repositories and libraries.' },
      { name: 'Cybersecurity & Ethical Hacking Guild', desc: 'CTF challenges, reverse engineering, vulnerability assessments, and network security.' }
    ];

    for (let g = 0; g < 48; g++) {
      const template = GROUP_TEMPLATES[g % GROUP_TEMPLATES.length];
      const creator = insertedUsers[(g * 5 + 1) % insertedUsers.length];
      const college = getRandomItem(colleges);
      const isAlexAdmin = g === 0;

      const groupRes = await client.query(
        `INSERT INTO groups (name, description, creator_id, college_id, visibility, max_members, status)
         VALUES ($1, $2, $3, $4, 'global', $5, 'open')
         RETURNING id`,
        [
          isAlexAdmin ? 'Alex Web Architecture Guild' : `${template.name} #${Math.floor(g / GROUP_TEMPLATES.length) + 1}`,
          template.desc,
          isAlexAdmin ? alexId : creator.id,
          college.id,
          Math.floor(Math.random() * 6) + 4
        ]
      );
      const groupId = groupRes.rows[0].id;
      createdGroups.push({ id: groupId, isAlexAdmin, collegeId: college.id, creatorId: isAlexAdmin ? alexId : creator.id });

      await client.query(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`, [groupId, isAlexAdmin ? alexId : creator.id]);

      const member1 = insertedUsers[(g * 7 + 2) % insertedUsers.length];
      if (member1.id !== alexId) {
        await client.query(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`, [groupId, member1.id]);
      }
    }

    console.log(`✓ Seeded ${createdGroups.length} active groups`);

    const boardPostingsToInsert: any[] = [];

    const MATCHED_TITLES = [
      { title: 'Full-Stack React + Node.js Engineer for Campus Event Platform', roles: ['Frontend Dev', 'API Architect'], skills: [reactSkillId, nodeSkillId, tsSkillId], interests: [hackathonInterestId] },
      { title: 'TypeScript & PostgreSQL Database Specialist Wanted', roles: ['Backend Engineer', 'DB Admin'], skills: [tsSkillId, pgSkillId], interests: [cloudInterestId] },
      { title: 'Docker & Cloud Deployment Engineer for AI Microservices', roles: ['DevOps Engineer', 'Cloud Specialist'], skills: [dockerSkillId, tsSkillId], interests: [cloudInterestId, aiInterestId] },
      { title: 'React.js Component Architect for Student Collaboration Hub', roles: ['React Specialist', 'UI Developer'], skills: [reactSkillId, tsSkillId], interests: [openSourceInterestId] },
      { title: 'Senior Backend Node.js / PostgreSQL Developer for Hackathon Team', roles: ['Backend Lead', 'Data Engineer'], skills: [nodeSkillId, pgSkillId], interests: [hackathonInterestId] },
      { title: 'AI Assistant Web App: Looking for Full-Stack React + TypeScript Lead', roles: ['Full Stack Lead'], skills: [reactSkillId, tsSkillId, nodeSkillId], interests: [aiInterestId] },
      { title: 'Containerization Specialist (Docker / Node.js) for Microservices Hub', roles: ['DevOps Lead'], skills: [dockerSkillId, nodeSkillId], interests: [cloudInterestId] },
      { title: 'Real-time WebSocket Platform: TypeScript + Redis + Node.js', roles: ['Distributed Systems Engineer'], skills: [nodeSkillId, tsSkillId], interests: [hackathonInterestId] },
      { title: 'Open-Source Student Dashboard: React.js & Tailwind Contributors Needed', roles: ['Frontend Engineer'], skills: [reactSkillId, tsSkillId], interests: [openSourceInterestId] },
      { title: 'PostgreSQL Query Optimization & Database Architect', roles: ['Database Engineer'], skills: [pgSkillId, nodeSkillId], interests: [cloudInterestId] }
    ];

    let matchedCount = 0;
    for (let i = 1; i < createdGroups.length && matchedCount < 30; i++) {
      const g = createdGroups[i];
      const template = MATCHED_TITLES[matchedCount % MATCHED_TITLES.length];
      boardPostingsToInsert.push({
        groupId: g.id,
        title: `${template.title} (Squad ${matchedCount + 1})`,
        description: `We need a skilled peer with hands-on proficiency to build high-performance collaborative features. Flexible milestones, fast feedback, and exciting demo days!`,
        rolesNeeded: template.roles,
        requiredSkillIds: template.skills,
        requiredInterestIds: template.interests,
        slotsTotal: Math.floor(Math.random() * 3) + 3,
        slotsFilled: Math.floor(Math.random() * 2) + 1,
        status: 'open'
      });
      matchedCount++;
    }

    const OTHER_SKILL_COMBOS = [
      { title: 'Embedded Vision & Computer Vision Developer', roles: ['CV Engineer', 'Robotics Specialist'], skillNames: ['Python', 'PyTorch', 'C++'], interestNames: ['Robotics', 'Artificial Intelligence'] },
      { title: 'Cross-Platform Mobile App Lead (Flutter & Dart)', roles: ['Mobile Architect'], skillNames: ['Flutter', 'React Native'], interestNames: ['Mobile Development', 'Startup Building'] },
      { title: 'Decentralized Smart Contract Developer (Rust / Go)', roles: ['Web3 Engineer'], skillNames: ['Rust', 'Go'], interestNames: ['Blockchain', 'Cybersecurity'] },
      { title: 'UI/UX Designer & Product Prototyper', roles: ['Lead Designer'], skillNames: ['UI Design', 'UX Design', 'Figma'], interestNames: ['Digital Art', 'Startup Building'] },
      { title: 'Competitive Programming Coach & Algo Strategist', roles: ['Algorithm Engineer'], skillNames: ['C++', 'Python'], interestNames: ['Competitive Programming', 'Mathematics'] },
      { title: 'Deep Learning Researcher for Medical Imaging', roles: ['ML Researcher'], skillNames: ['Deep Learning', 'PyTorch', 'Python'], interestNames: ['Research', 'Artificial Intelligence'] },
      { title: 'Kubernetes Infrastructure & Cloud Automation', roles: ['Site Reliability Engineer'], skillNames: ['Kubernetes', 'Linux'], interestNames: ['Cloud Computing'] },
      { title: 'Game Engine Programmer (Unity / Unreal / C++)', roles: ['Graphics Programmer'], skillNames: ['C++', 'C#'], interestNames: ['Game Development'] }
    ];

    let otherCount = 0;
    while (boardPostingsToInsert.length < 100) {
      const g = createdGroups[(otherCount + 2) % createdGroups.length];
      const template = OTHER_SKILL_COMBOS[otherCount % OTHER_SKILL_COMBOS.length];
      const requiredSkillIds = template.skillNames.map(name => skillMap.get(name)).filter(Boolean);
      const requiredInterestIds = template.interestNames.map(name => interestMap.get(name)).filter(Boolean);

      boardPostingsToInsert.push({
        groupId: g.id,
        title: `${template.title} (Batch ${otherCount + 1})`,
        description: `Join our specialized project group to build cutting-edge components and prepare for national showcase presentations.`,
        rolesNeeded: template.roles,
        requiredSkillIds,
        requiredInterestIds,
        slotsTotal: Math.floor(Math.random() * 4) + 3,
        slotsFilled: Math.floor(Math.random() * 2),
        status: 'open'
      });
      otherCount++;
    }

    console.log(`Inserting ${boardPostingsToInsert.length} board postings...`);
    const insertedPostings: any[] = [];
    for (const bp of boardPostingsToInsert) {
      const res = await client.query(
        `INSERT INTO board_postings (group_id, title, description, roles_needed, required_skill_ids, required_interest_ids, slots_total, slots_filled, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
         RETURNING id, group_id, title`,
        [bp.groupId, bp.title, bp.description, bp.rolesNeeded, bp.requiredSkillIds, bp.requiredInterestIds, bp.slotsTotal, bp.slotsFilled]
      );
      insertedPostings.push(res.rows[0]);
    }
    console.log(`✓ Seeded ${insertedPostings.length} board postings (including ${matchedCount} matched to Alex)`);

    const alexGroup = createdGroups[0];
    const alexPostingRes = await client.query(
      `INSERT INTO board_postings (group_id, title, description, roles_needed, required_skill_ids, required_interest_ids, slots_total, slots_filled, status)
       VALUES ($1, 'Looking for Mobile App Developer (Flutter / React Native)', 'Expand our web platform to native mobile apps.', ARRAY['Mobile Developer'], $2, $3, 4, 1, 'open')
       RETURNING id`,
      [alexGroup.id, [skillMap.get('Flutter')!], [interestMap.get('Startup Building')!]]
    );
    const alexPostingId = alexPostingRes.rows[0].id;

    const snehaId = insertedUsers[2].id;
    const rohanId = insertedUsers[3].id;
    await client.query(
      `INSERT INTO join_requests (posting_id, group_id, user_id, status, message)
       VALUES ($1, $2, $3, 'pending', 'Hey Alex, I have built multiple Flutter apps with 10k users. Would love to collaborate!')
       ON CONFLICT (posting_id, user_id) DO NOTHING`,
      [alexPostingId, alexGroup.id, snehaId]
    );
    await client.query(
      `INSERT INTO join_requests (posting_id, group_id, user_id, status, message)
       VALUES ($1, $2, $3, 'pending', 'Excited about this architecture, Alex! Can help with API integration.')
       ON CONFLICT (posting_id, user_id) DO NOTHING`,
      [alexPostingId, alexGroup.id, rohanId]
    );

    const targetPosting = insertedPostings[0];
    await client.query(
      `INSERT INTO join_requests (posting_id, group_id, user_id, status, message)
       VALUES ($1, $2, $3, 'pending', 'Hey! I have strong React & Node.js experience and would love to contribute to this team.')
       ON CONFLICT (posting_id, user_id) DO NOTHING`,
      [targetPosting.id, targetPosting.group_id, alexId]
    );
    console.log('✓ Seeded incoming & outgoing join requests');

    console.log('Precomputing recommendations for Alex and caching in Redis...');

    const secondDegreeCandidatesRes = await client.query(
      `SELECT e2.friend_id as candidate_id, 
              COUNT(DISTINCT e1.friend_id) as mutual_count,
              MIN(e1.friend_id::text) as via_id
       FROM connection_edges e1
       JOIN connection_edges e2 ON e1.friend_id = e2.user_id
       WHERE e1.user_id = $1 
         AND e2.friend_id <> $1
         AND NOT EXISTS (SELECT 1 FROM connection_edges ex WHERE ex.user_id = $1 AND ex.friend_id = e2.friend_id)
       GROUP BY e2.friend_id
       ORDER BY mutual_count DESC, candidate_id ASC
       LIMIT 40`,
      [alexId]
    );

    const secondDegreeRecs = secondDegreeCandidatesRes.rows;
    for (let r = 0; r < secondDegreeRecs.length; r++) {
      const rec = secondDegreeRecs[r];
      const rank = r + 1;
      const score = Math.max(95 - r * 2, 40);
      await client.query(
        `INSERT INTO recommendations (user_id, candidate_id, rec_type, score, rank, via_connection_id, mutual_count)
         VALUES ($1, $2, 'second_degree', $3, $4, $5, $6)
         ON CONFLICT (user_id, candidate_id, rec_type) DO UPDATE SET score = EXCLUDED.score, rank = EXCLUDED.rank`,
        [alexId, rec.candidate_id, score, rank, rec.via_id, rec.mutual_count]
      );
    }

    const similarityCandidatesRes = await client.query(
      `SELECT u.id as candidate_id,
              (COUNT(DISTINCT us.skill_id) * 10 + COUNT(DISTINCT ui.interest_id) * 6 + CASE WHEN u.college_id = $2 THEN 30 ELSE 0 END) as score
       FROM users u
       LEFT JOIN user_skills us ON us.user_id = u.id AND us.skill_id = ANY(ARRAY[$3, $4, $5, $6, $7]::uuid[])
       LEFT JOIN user_interests ui ON ui.user_id = u.id AND ui.interest_id = ANY(ARRAY[$8, $9, $10, $11]::uuid[])
       WHERE u.id <> $1
         AND NOT EXISTS (SELECT 1 FROM connection_edges ex WHERE ex.user_id = $1 AND ex.friend_id = u.id)
       GROUP BY u.id
       HAVING COUNT(DISTINCT us.skill_id) + COUNT(DISTINCT ui.interest_id) >= 1
       ORDER BY score DESC, u.id ASC
       LIMIT 40`,
      [alexId, iitbCollegeId, reactSkillId, nodeSkillId, tsSkillId, pgSkillId, dockerSkillId, aiInterestId, hackathonInterestId, openSourceInterestId, cloudInterestId]
    );

    const similarityRecs = similarityCandidatesRes.rows;
    for (let r = 0; r < similarityRecs.length; r++) {
      const rec = similarityRecs[r];
      const rank = r + 1;
      await client.query(
        `INSERT INTO recommendations (user_id, candidate_id, rec_type, score, rank)
         VALUES ($1, $2, 'similarity', $3, $4)
         ON CONFLICT (user_id, candidate_id, rec_type) DO UPDATE SET score = EXCLUDED.score, rank = EXCLUDED.rank`,
        [alexId, rec.candidate_id, rec.score, rank]
      );
    }

    try {
      if (secondDegreeRecs.length > 0) {
        await redis.del(`rec:2nd:${alexId}`);
        const zaddArgs: any[] = [];
        secondDegreeRecs.forEach((r, idx) => {
          zaddArgs.push(idx + 1, r.candidate_id);
        });
        await redis.zadd(`rec:2nd:${alexId}`, ...(zaddArgs as [any, ...any[]]));
      }

      if (similarityRecs.length > 0) {
        await redis.del(`rec:sim:${alexId}`);
        const zaddArgs: any[] = [];
        similarityRecs.forEach((r, idx) => {
          zaddArgs.push(idx + 1, r.candidate_id);
        });
        await redis.zadd(`rec:sim:${alexId}`, ...(zaddArgs as [any, ...any[]]));
      }
      console.log('✓ Recommendations cached in Redis');
    } catch (redisErr) {
      console.log('ℹ Redis caching skipped (Postgres fallback active)');
    }

    console.log('\n======================================================');
    console.log('🎉 Seed complete! Demo credentials:');
    console.log('   Email:      alex@iitb.ac.in');
    console.log('   Password:   Password123!');
    console.log(`   Users:      ${insertedUsers.length}`);
    console.log(`   Boards:     ${insertedPostings.length + 1} (30 matched to Alex)`);
    console.log(`   2nd Degree: ${secondDegreeRecs.length} suggestions`);
    console.log(`   Similarity: ${similarityRecs.length} suggestions`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    try {
      redis.disconnect();
    } catch {}
    process.exit(0);
  }
}

seed();
