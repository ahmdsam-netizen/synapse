/**
 * Seed script: Sayem Ahmad (sayem@nitsri.ac.in)
 *
 * Creates a rich demo account for Sayem with:
 *   - Direct connections (1st degree)
 *   - 2nd degree connections via mutual friends
 *   - A community he owns
 *   - A project group he owns (with incoming join requests)
 *   - Membership in 3 existing groups
 *   - Incoming pending connection requests
 *   - Outgoing pending connection requests
 *   - An outgoing group join request
 *
 * Run:
 *   npx tsx scripts/seed-sayem.ts
 *
 * Safe to run multiple times (uses ON CONFLICT DO NOTHING throughout).
 */

import bcrypt from 'bcryptjs';
import { pool } from '../src/config/database.js';
import { redis } from '../src/config/redis.js';

async function seedSayem() {
  const client = await pool.connect();

  try {
    console.log('--- Seeding Sayem Ahmad ---');

    // ----------------------------------------------------------------
    // 1. Ensure NIT Srinagar college exists
    // ----------------------------------------------------------------
    await client.query(`
      INSERT INTO colleges (name, email_domain, city)
      VALUES ('National Institute of Technology Srinagar', 'nitsri.ac.in', 'Srinagar')
      ON CONFLICT (email_domain) DO NOTHING
    `);

    const collegeRes = await client.query(
      `SELECT id FROM colleges WHERE email_domain = 'nitsri.ac.in'`
    );
    const nitsriCollegeId: string = collegeRes.rows[0].id;
    console.log(`College ID (nitsri.ac.in): ${nitsriCollegeId}`);

    // ----------------------------------------------------------------
    // 2. Resolve skill and interest IDs
    // ----------------------------------------------------------------
    const skillNames = ['TypeScript', 'React.js', 'Node.js', 'Python', 'Docker', 'PostgreSQL'];
    const interestNames = ['Artificial Intelligence', 'Hackathons', 'Open Source Contributing', 'Cloud Computing', 'Data Science & AI'];

    const skillRes = await client.query(
      `SELECT id, name FROM skills WHERE name = ANY($1::text[])`,
      [skillNames]
    );
    const skillMap = new Map<string, string>(skillRes.rows.map((r: any) => [r.name, r.id]));

    const interestRes = await client.query(
      `SELECT id, name FROM interests WHERE name = ANY($1::text[])`,
      [interestNames]
    );
    const interestMap = new Map<string, string>(interestRes.rows.map((r: any) => [r.name, r.id]));

    // ----------------------------------------------------------------
    // 3. Create Sayem's user account
    // ----------------------------------------------------------------
    const passwordHash = await bcrypt.hash('Password123', 10);

    const sayemRes = await client.query(`
      INSERT INTO users (email, password_hash, name, college_id, year_of_study, branch, looking_for, bio, avatar_url, profile_completeness)
      VALUES (
        'sayem@nitsri.ac.in',
        $1,
        'Sayem Ahmad',
        $2,
        3,
        'Computer Science & Engineering',
        'both',
        'Full-stack developer from NIT Srinagar. Interested in distributed systems, AI tooling, and building real-world platforms. Open to hackathon teams and research collaborations.',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
        100
      )
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [passwordHash, nitsriCollegeId]);

    const sayemId: string = sayemRes.rows[0].id;
    console.log(`Sayem user ID: ${sayemId}`);

    // ----------------------------------------------------------------
    // 4. Skills
    // ----------------------------------------------------------------
    const sayemSkills = [
      { name: 'TypeScript', prof: 'advanced' },
      { name: 'React.js', prof: 'advanced' },
      { name: 'Node.js', prof: 'advanced' },
      { name: 'Python', prof: 'intermediate' },
      { name: 'Docker', prof: 'intermediate' },
      { name: 'PostgreSQL', prof: 'intermediate' },
    ];

    for (const s of sayemSkills) {
      const sid = skillMap.get(s.name);
      if (sid) {
        await client.query(
          `INSERT INTO user_skills (user_id, skill_id, proficiency) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [sayemId, sid, s.prof]
        );
      }
    }
    console.log('Skills inserted.');

    // ----------------------------------------------------------------
    // 5. Interests
    // ----------------------------------------------------------------
    const sayemInterests = ['Artificial Intelligence', 'Hackathons', 'Open Source Contributing', 'Cloud Computing'];
    for (const name of sayemInterests) {
      const iid = interestMap.get(name);
      if (iid) {
        await client.query(
          `INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [sayemId, iid]
        );
      }
    }
    console.log('Interests inserted.');

    // ----------------------------------------------------------------
    // 6. Work items
    // ----------------------------------------------------------------
    await client.query(`
      INSERT INTO work_items (user_id, title, description, tech_used, repo_url, live_url)
      VALUES
        ($1, 'Synapse - Student Collaboration Platform',
         'Microservices-based platform for skill-matched student collaboration. Built with React, Node.js, and PostgreSQL with pgvector recommendations.',
         ARRAY['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'Redis'],
         'https://github.com/sayem/synapse', 'http://synapse.live'),
        ($1, 'AI Resume Analyzer',
         'Parses resumes and scores candidate-job fit using cosine similarity on sentence embeddings.',
         ARRAY['Python', 'FastAPI', 'pgvector', 'Docker'],
         'https://github.com/sayem/ai-resume', NULL)
    `, [sayemId]);
    console.log('Work items inserted.');

    // ----------------------------------------------------------------
    // 7. Resolve direct connection targets
    //    Connect Sayem to Alex + 5 of Alex's core friends
    // ----------------------------------------------------------------
    const directEmails = [
      'alex@iitb.ac.in',      // Alex (the primary demo user)
      'priya@iitb.ac.in',     // Priya Patel
      'kabir@iitd.ac.in',     // Kabir Verma
      'dev@iitm.ac.in',       // Dev Gupta
      'tanvi@iitb.ac.in',     // Tanvi Joshi
      'ananya@iitb.ac.in',    // Ananya Iyer
    ];

    const directUserRes = await client.query(
      `SELECT id, email FROM users WHERE email = ANY($1::text[])`,
      [directEmails]
    );
    const directFriends = directUserRes.rows;

    for (const friend of directFriends) {
      // connections row (bidirectional pair stored as one accepted row)
      await client.query(`
        INSERT INTO connections (requester_id, receiver_id, status)
        VALUES ($1, $2, 'accepted')
        ON CONFLICT (requester_id, receiver_id) DO NOTHING
      `, [sayemId, friend.id]);

      // Symmetric edge table (two rows per accepted connection)
      await client.query(`
        INSERT INTO connection_edges (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
      `, [sayemId, friend.id]);
      await client.query(`
        INSERT INTO connection_edges (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
      `, [friend.id, sayemId]);
    }
    console.log(`Direct connections created: ${directFriends.length}`);

    // ----------------------------------------------------------------
    // 8. 2nd-degree connections
    //    Find users connected to Sayem's direct friends but not to Sayem
    // ----------------------------------------------------------------
    const secondDegreeRes = await client.query(`
      SELECT DISTINCT ce2.friend_id
      FROM connection_edges ce1
      JOIN connection_edges ce2 ON ce1.friend_id = ce2.user_id
      WHERE ce1.user_id = $1
        AND ce2.friend_id <> $1
        AND NOT EXISTS (
          SELECT 1 FROM connection_edges ex
          WHERE ex.user_id = $1 AND ex.friend_id = ce2.friend_id
        )
      LIMIT 20
    `, [sayemId]);
    console.log(`2nd-degree network: ${secondDegreeRes.rows.length} users visible via mutual friends`);

    // ----------------------------------------------------------------
    // 9. Incoming pending connection requests (3 random users -> Sayem)
    // ----------------------------------------------------------------
    const incomingReqRes = await client.query(`
      SELECT id FROM users
      WHERE id <> $1
        AND NOT EXISTS (SELECT 1 FROM connections c WHERE (c.requester_id = $1 AND c.receiver_id = id) OR (c.requester_id = id AND c.receiver_id = $1))
      ORDER BY RANDOM()
      LIMIT 3
    `, [sayemId]);

    for (const u of incomingReqRes.rows) {
      await client.query(`
        INSERT INTO connections (requester_id, receiver_id, status)
        VALUES ($1, $2, 'pending')
        ON CONFLICT (requester_id, receiver_id) DO NOTHING
      `, [u.id, sayemId]);
    }
    console.log(`Incoming connection requests: ${incomingReqRes.rows.length}`);

    // ----------------------------------------------------------------
    // 10. Outgoing pending connection requests (Sayem -> 3 random users)
    // ----------------------------------------------------------------
    const outgoingReqRes = await client.query(`
      SELECT id FROM users
      WHERE id <> $1
        AND NOT EXISTS (SELECT 1 FROM connections c WHERE (c.requester_id = $1 AND c.receiver_id = id) OR (c.requester_id = id AND c.receiver_id = $1))
      ORDER BY RANDOM()
      LIMIT 3
    `, [sayemId]);

    for (const u of outgoingReqRes.rows) {
      await client.query(`
        INSERT INTO connections (requester_id, receiver_id, status)
        VALUES ($1, $2, 'pending')
        ON CONFLICT (requester_id, receiver_id) DO NOTHING
      `, [sayemId, u.id]);
    }
    console.log(`Outgoing connection requests: ${outgoingReqRes.rows.length}`);

    // ----------------------------------------------------------------
    // 11. Resolve a college ID for creating groups
    // ----------------------------------------------------------------
    const anyCollegeRes = await client.query(`SELECT id FROM colleges WHERE email_domain = 'iitb.ac.in'`);
    const iitbCollegeId: string = anyCollegeRes.rows[0].id;

    // ----------------------------------------------------------------
    // 12. Community that Sayem owns
    // ----------------------------------------------------------------
    const communityRes = await client.query(`
      INSERT INTO groups (name, description, creator_id, college_id, visibility, max_members, status, is_community)
      VALUES (
        'NIT Srinagar Tech Circle',
        'A community for NIT Srinagar students to share projects, find hackathon teammates, and collaborate on open-source work.',
        $1, $2, 'global', 100, 'open', TRUE
      )
      RETURNING id
    `, [sayemId, nitsriCollegeId]);
    const communityId: string = communityRes.rows[0].id;

    await client.query(`
      INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING
    `, [communityId, sayemId]);

    // Add 4 of Sayem's direct friends as community members
    for (const friend of directFriends.slice(0, 4)) {
      await client.query(`
        INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING
      `, [communityId, friend.id]);
    }
    console.log(`Community created: NIT Srinagar Tech Circle (${communityId})`);

    // ----------------------------------------------------------------
    // 13. Project group that Sayem owns + board posting with incoming join requests
    // ----------------------------------------------------------------
    const groupRes = await client.query(`
      INSERT INTO groups (name, description, creator_id, college_id, visibility, max_members, status, is_community)
      VALUES (
        'Sayem Open-Source Dev Squad',
        'Building an open-source developer tools suite with TypeScript, React, and Node.js. Looking for contributors passionate about DX and performance.',
        $1, $2, 'global', 6, 'open', FALSE
      )
      RETURNING id
    `, [sayemId, nitsriCollegeId]);
    const sayemGroupId: string = groupRes.rows[0].id;

    await client.query(`
      INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING
    `, [sayemGroupId, sayemId]);

    // Add 2 direct friends as members
    for (const friend of directFriends.slice(0, 2)) {
      await client.query(`
        INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING
      `, [sayemGroupId, friend.id]);
    }

    // Board posting in Sayem's group
    const reactSkillId = skillMap.get('React.js');
    const tsSkillId = skillMap.get('TypeScript');
    const nodeSkillId = skillMap.get('Node.js');
    const aiInterestId = interestMap.get('Artificial Intelligence');
    const openSourceInterestId = interestMap.get('Open Source Contributing');

    const postingRes = await client.query(`
      INSERT INTO board_postings (group_id, title, description, roles_needed, required_skill_ids, required_interest_ids, slots_total, slots_filled, status)
      VALUES (
        $1,
        'React + TypeScript Component Library Contributor',
        'We are building a reusable, accessible component library for student developer tools. Looking for someone who knows React well and cares about clean APIs and documentation.',
        ARRAY['Frontend Developer', 'Open Source Contributor'],
        $2,
        $3,
        4, 1, 'open'
      )
      RETURNING id
    `, [
      sayemGroupId,
      [reactSkillId, tsSkillId].filter(Boolean),
      [openSourceInterestId, aiInterestId].filter(Boolean)
    ]);
    const postingId: string = postingRes.rows[0].id;

    // Incoming join requests to Sayem's posting (from 2 of his direct friends)
    const joinRequestMessages = [
      'I have been building React component libraries for 2 years. Would love to contribute to this project.',
      'Strong TypeScript and React experience here. This aligns perfectly with what I am working on.'
    ];
    for (let i = 0; i < 2 && i < directFriends.length; i++) {
      const applicant = directFriends[i + 2]; // skip Alex and Priya (already members)
      if (!applicant) continue;
      await client.query(`
        INSERT INTO join_requests (posting_id, group_id, user_id, status, message)
        VALUES ($1, $2, $3, 'pending', $4)
        ON CONFLICT (posting_id, user_id) DO NOTHING
      `, [postingId, sayemGroupId, applicant.id, joinRequestMessages[i]]);
    }
    console.log(`Project group + posting + incoming join requests created.`);

    // ----------------------------------------------------------------
    // 14. Add Sayem as member of 3 existing groups (seeded by main seed)
    // ----------------------------------------------------------------
    const existingGroupsRes = await client.query(`
      SELECT id FROM groups
      WHERE creator_id <> $1
        AND status = 'open'
        AND NOT EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = groups.id AND gm.user_id = $1)
      ORDER BY created_at ASC
      LIMIT 3
    `, [sayemId]);

    for (const g of existingGroupsRes.rows) {
      await client.query(`
        INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING
      `, [g.id, sayemId]);
    }
    console.log(`Joined ${existingGroupsRes.rows.length} existing groups as member.`);

    // ----------------------------------------------------------------
    // 15. Outgoing join request from Sayem to a group he is not in
    // ----------------------------------------------------------------
    const targetGroupRes = await client.query(`
      SELECT bp.id as posting_id, bp.group_id
      FROM board_postings bp
      JOIN groups g ON g.id = bp.group_id
      WHERE bp.status = 'open'
        AND g.creator_id <> $1
        AND NOT EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = bp.group_id AND gm.user_id = $1)
        AND NOT EXISTS (SELECT 1 FROM join_requests jr WHERE jr.posting_id = bp.id AND jr.user_id = $1)
      LIMIT 1
    `, [sayemId]);

    if (targetGroupRes.rows.length > 0) {
      const target = targetGroupRes.rows[0];
      await client.query(`
        INSERT INTO join_requests (posting_id, group_id, user_id, status, message)
        VALUES ($1, $2, $3, 'pending', 'I have strong React and TypeScript skills and would love to contribute to this initiative.')
        ON CONFLICT (posting_id, user_id) DO NOTHING
      `, [target.posting_id, target.group_id, sayemId]);
      console.log('Outgoing join request created.');
    }

    // ----------------------------------------------------------------
    // 16. Group invite - send Sayem an invite to one of Alex's groups
    // ----------------------------------------------------------------
    const alexRes = await client.query(`SELECT id FROM users WHERE email = 'alex@iitb.ac.in'`);
    if (alexRes.rows.length > 0) {
      const alexId: string = alexRes.rows[0].id;
      const alexGroupRes = await client.query(`
        SELECT id FROM groups WHERE creator_id = $1 LIMIT 1
      `, [alexId]);

      if (alexGroupRes.rows.length > 0) {
        const alexGroupId: string = alexGroupRes.rows[0].id;
        await client.query(`
          INSERT INTO group_invites (group_id, inviter_id, invitee_id, note, status)
          VALUES ($1, $2, $3, 'Hey Sayem, you would be a great fit for our web architecture group!', 'pending')
          ON CONFLICT DO NOTHING
        `, [alexGroupId, alexId, sayemId]);
        console.log('Group invite from Alex received.');
      }
    }

    // ----------------------------------------------------------------
    // 17. Seed recommendations for Sayem in Redis
    // ----------------------------------------------------------------
    try {
      const recRes = await client.query(`
        SELECT e2.friend_id as candidate_id,
               COUNT(DISTINCT e1.friend_id) as mutual_count
        FROM connection_edges e1
        JOIN connection_edges e2 ON e1.friend_id = e2.user_id
        WHERE e1.user_id = $1
          AND e2.friend_id <> $1
          AND NOT EXISTS (SELECT 1 FROM connection_edges ex WHERE ex.user_id = $1 AND ex.friend_id = e2.friend_id)
        GROUP BY e2.friend_id
        ORDER BY mutual_count DESC
        LIMIT 30
      `, [sayemId]);

      if (recRes.rows.length > 0) {
        await redis.del(`rec:2nd:${sayemId}`);
        const args: any[] = [];
        recRes.rows.forEach((r: any, idx: number) => { args.push(idx + 1, r.candidate_id); });
        await redis.zadd(`rec:2nd:${sayemId}`, ...(args as [any, ...any[]]));
        console.log(`Cached ${recRes.rows.length} 2nd-degree recs for Sayem in Redis.`);
      }
    } catch {
      console.log('Redis caching skipped (Postgres fallback will be used).');
    }

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------
    console.log('\n=========================================================');
    console.log('Sayem Ahmad account ready:');
    console.log('  Email:    sayem@nitsri.ac.in');
    console.log('  Password: Password123');
    console.log(`  User ID:  ${sayemId}`);
    console.log(`  Direct connections:          ${directFriends.length}`);
    console.log(`  2nd-degree network visible:  ${secondDegreeRes.rows.length}`);
    console.log(`  Incoming connection requests: ${incomingReqRes.rows.length}`);
    console.log(`  Outgoing connection requests: ${outgoingReqRes.rows.length}`);
    console.log('  Community owned:             NIT Srinagar Tech Circle');
    console.log('  Project group owned:         Sayem Open-Source Dev Squad');
    console.log('  Incoming join requests:      2');
    console.log('  Existing groups joined:      3');
    console.log('  Outgoing join request:       1');
    console.log('  Group invite received:       1 (from Alex)');
    console.log('=========================================================\n');

  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    try { redis.disconnect(); } catch {}
    process.exit(0);
  }
}

seedSayem();
