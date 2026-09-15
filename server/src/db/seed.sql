-- Colleges
INSERT INTO colleges (name, email_domain, city) VALUES
('Indian Institute of Technology Bombay', 'iitb.ac.in', 'Mumbai'),
('Indian Institute of Technology Delhi', 'iitd.ac.in', 'New Delhi'),
('National Institute of Technology Trichy', 'nitt.edu', 'Tiruchirappalli'),
('Birla Institute of Technology and Science', 'bits-pilani.ac.in', 'Pilani'),
('Vellore Institute of Technology', 'vit.ac.in', 'Vellore'),
('Delhi Technological University', 'dtu.ac.in', 'New Delhi'),
('Indian Institute of Technology Madras', 'iitm.ac.in', 'Chennai'),
('Jadavpur University', 'jadavpuruniversity.in', 'Kolkata'),
('SRM Institute of Science and Technology', 'srmist.edu.in', 'Chennai'),
('Indian Institute of Information Technology Hyderabad', 'iiit.ac.in', 'Hyderabad')
ON CONFLICT (email_domain) DO NOTHING;

-- Skills
INSERT INTO skills (name, category) VALUES
-- Programming Languages
('JavaScript', 'Programming Languages'),
('Python', 'Programming Languages'),
('Java', 'Programming Languages'),
('C++', 'Programming Languages'),
('C', 'Programming Languages'),
('TypeScript', 'Programming Languages'),
('Ruby', 'Programming Languages'),
('Go', 'Programming Languages'),
('Rust', 'Programming Languages'),
('Swift', 'Programming Languages'),
('Kotlin', 'Programming Languages'),
('C#', 'Programming Languages'),
-- Web Development
('HTML5', 'Web Development'),
('CSS3', 'Web Development'),
('React.js', 'Web Development'),
('Node.js', 'Web Development'),
('Express.js', 'Web Development'),
('Angular', 'Web Development'),
('Vue.js', 'Web Development'),
('Next.js', 'Web Development'),
('Tailwind CSS', 'Web Development'),
-- Mobile Development
('React Native', 'Mobile Development'),
('Flutter', 'Mobile Development'),
('Android Development', 'Mobile Development'),
('iOS Development', 'Mobile Development'),
-- Data Science & AI
('Machine Learning', 'Data Science & AI'),
('Deep Learning', 'Data Science & AI'),
('Data Analysis', 'Data Science & AI'),
('Pandas', 'Data Science & AI'),
('NumPy', 'Data Science & AI'),
('TensorFlow', 'Data Science & AI'),
('PyTorch', 'Data Science & AI'),
('NLP', 'Data Science & AI'),
-- Design
('UI Design', 'Design'),
('UX Design', 'Design'),
('Figma', 'Design'),
('Adobe XD', 'Design'),
('Photoshop', 'Design'),
('Illustrator', 'Design'),
-- DevOps & Cloud
('Docker', 'DevOps & Cloud'),
('Kubernetes', 'DevOps & Cloud'),
('AWS', 'DevOps & Cloud'),
('Google Cloud Platform', 'DevOps & Cloud'),
('Microsoft Azure', 'DevOps & Cloud'),
('CI/CD', 'DevOps & Cloud'),
('Linux', 'DevOps & Cloud'),
-- Database
('PostgreSQL', 'Database'),
('MySQL', 'Database'),
('MongoDB', 'Database'),
('Redis', 'Database'),
-- Soft Skills
('Leadership', 'Soft Skills'),
('Public Speaking', 'Soft Skills'),
('Project Management', 'Soft Skills'),
('Team Building', 'Soft Skills')
ON CONFLICT (name) DO NOTHING;

-- Interests
INSERT INTO interests (name, category) VALUES
-- Technology
('Artificial Intelligence', 'Technology'),
('Blockchain', 'Technology'),
('Cybersecurity', 'Technology'),
('Internet of Things', 'Technology'),
('Open Source Contributing', 'Technology'),
('Game Development', 'Technology'),
('Augmented Reality', 'Technology'),
('Virtual Reality', 'Technology'),
('Robotics', 'Technology'),
('Cloud Computing', 'Technology'),
-- Academic
('Research', 'Academic'),
('Mathematics', 'Academic'),
('Physics', 'Academic'),
('Competitive Programming', 'Academic'),
('Hackathons', 'Academic'),
('Literature Review', 'Academic'),
('Economics', 'Academic'),
-- Creative
('Photography', 'Creative'),
('Video Editing', 'Creative'),
('Content Creation', 'Creative'),
('Blogging', 'Creative'),
('Podcasting', 'Creative'),
('Music Production', 'Creative'),
('Digital Art', 'Creative'),
-- Professional
('Entrepreneurship', 'Professional'),
('Startup Building', 'Professional'),
('Investing', 'Professional'),
('Product Management', 'Professional'),
('Marketing', 'Professional'),
('Finance', 'Professional'),
('Consulting', 'Professional')
ON CONFLICT (name) DO NOTHING;
