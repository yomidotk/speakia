import type { CastId } from './cast';

export type PlaceId = 'gate' | 'office' | 'cafe' | 'library' | 'lab' | 'amphi';

export type Hints = { idea: string; starter: string; example: string };

export type RoleOption = {
  guide?: Guide;
  firstSpeaker?: 'learner' | 'partner';
  player?: CastId;           // the character whose side the learner takes (none in guided episodes)
  partner: CastId;           // the character the AI plays
  mission: string;           // short, shown on the role card
  goal: string;              // full goal sent to the AI
  opening: string;           // partner's first line to the learner
  firstHints: Hints;         // hints for the learner's first answer
  demoReplies: string[];     // used when no server is configured
};

export type Episode = {
  id: string;
  season: number;
  level: number;
  title: string;
  place: PlaceId;
  placeName: string;
  time: string;
  focus: string;
  summary: string;
  setting: string;           // sent to the AI
  scene: { who: CastId; text: string }[];
  roles: RoleOption[];
  maxTurns: number;
  playable: boolean;
  guide?: Guide;             // guided episodes: no scene or sides, the partner follows a script
};

/**
 * A guided conversation: the partner asks the teacher's lines in order. After each answer the AI
 * writes only a short `react`ion to what the learner actually said; then the partner says `say`
 * (fixed, so it can be voiced in advance). `react` here is the fallback when there is no AI.
 */
export type GuideLine = { id?: string; stage?: string; criterion?: string; terminal?: boolean; react?: string; say: string; hints?: Hints };
export type Guide = { mode?: 'scripted' | 'respond'; partner: CastId; mission: string; goal: string; facts: string[]; lines: GuideLine[] };

/** Guided episodes run through the same speaking screen as one built-in "role". */
export function guideRole(g: Guide): RoleOption {
  return {
    partner: g.partner,
    mission: g.mission,
    goal: g.goal,
    opening: g.lines[0].say,
    firstHints: g.lines[0].hints ?? { idea: 'Answer the question.', starter: 'I…', example: '' },
    demoReplies: g.lines.slice(1).map((l) => l.react ?? ''),
  };
}

export const EPISODES: Episode[] = [
  {
    // Scenario B1 written by the team's English teacher. Small wording changes so every line works
    // whatever the learner answered: each line's opening reaction is split into `react`, Stage 3's
    // "It's on the ground floor" became "Student Services is…", and Stage 4 says "I'm in the debate
    // club" instead of "too" (the learner may not pick debate).
    id: 'orientation', season: 1, level: 1, title: 'Orientation Day', place: 'gate', placeName: 'Campus gate',
    time: 'Sunday · 08:30', focus: 'Talking about yourself and asking for information',
    summary: 'Your first day on campus. Sara welcomes you at the check-in desk and helps you get ready.',
    setting:
      'Orientation Day at a university in Algeria. Sara, a friendly student volunteer, is at the check-in desk welcoming new students. The learner is a new student arriving for their first day.',
    scene: [], roles: [], maxTurns: 13, playable: true,
    guide: {
      partner: 'sara',
      mission: 'Check in for Orientation Day. Answer Sara’s questions and ask about anything that isn’t clear.',
      goal: 'check in, talk about yourself and your journey, and ask questions about the campus and the day',
      facts: [
        'The welcome pack has the timetable, a campus map and the Wi-Fi login.',
        'Student cards: go to Student Services with an ID photo before Friday. Friday is the deadline.',
        'Student Services is on the ground floor of the main building; they take the photo there for free.',
        'The library has silent rooms on the second floor. Group study spaces are in the student union.',
        'Today: a welcome talk at 11 in Lecture Hall A, then a choice between a campus tour and a workshop about the online learning platform.',
        'This afternoon there is the clubs fair. Sara is in the debate club; it meets every Wednesday.',
        'Sara will be at the cafeteria at lunchtime.',
      ],
      lines: [
        // Stage 1 · Check-in
        { say: 'Hi there, welcome to Orientation Day! Have you already registered online, or would you like to do it here?',
          hints: { idea: 'Say if you registered online or not.', starter: 'I registered online…', example: 'I registered online last week.' } },
        { react: 'Perfect.', say: 'Could I have your full name and your student number, please?',
          hints: { idea: 'Use a polite form: Sure… / Sorry, I’m not sure…', starter: 'Sure, my name is…', example: 'Sure, my name is Amina Benali and my student number is 2026-0415.' } },
        // Stage 2 · Getting to know each other
        { react: 'Great, you’re on the list.', say: 'So, how was your journey here this morning?',
          hints: { idea: 'Tell Sara what happened, in the past: I took… / It took me…', starter: 'It was fine, but…', example: 'It was fine, but the bus was very crowded. It took me about an hour.' } },
        { react: 'Oh no!', say: 'And why did you decide to study here? There are a lot of universities to choose from.',
          hints: { idea: 'Give a reason with “because”.', starter: 'I chose this university because…', example: 'I chose this university because it has a good reputation for computer science.' } },
        { react: 'That’s a good reason.', say: 'Have you ever lived away from your family before?',
          hints: { idea: 'Answer with “never” or “before”, and say how it feels.', starter: 'No, never. This is…', example: 'No, never. This is the first time, so it’s a big change.' } },
        // Stage 3 · Welcome pack and practical information
        { say: 'Here’s your welcome pack. It’s got your timetable, a campus map and your Wi-Fi login. For your student card, you need to go to Student Services with an ID photo before Friday.',
          hints: { idea: 'If something isn’t clear, ask Sara to repeat or explain.', starter: 'Sorry, did you say…', example: 'Sorry, did you say before Friday? Where is Student Services exactly?' } },
        { react: 'Yes, Friday is the deadline.', say: 'Student Services is on the ground floor of the main building, and they can take the photo there for free. Is there anything you’re worried about at the moment?',
          hints: { idea: 'Say what makes you nervous: I’m a bit nervous about… / I’m worried about…', starter: 'I’m a bit nervous about…', example: 'I’m worried about making friends because I don’t know anyone here.' } },
        { react: 'That’s completely normal.', say: 'Most new students feel the same. If I were you, I’d join the campus tour today and talk to people in your group. What about studying? Do you prefer working alone or with other people?',
          hints: { idea: 'Say what you prefer and why.', starter: 'I prefer working alone because…', example: 'I prefer working alone because I can concentrate better. Is there a quiet place to study?' } },
        { say: 'The library has silent rooms on the second floor, and there are group study spaces in the student union.',
          hints: { idea: 'React, then ask a follow-up question.', starter: 'That sounds useful. Do I…', example: 'That sounds useful. Do I need to book them?' } },
        // Stage 4 · Today's programme and clubs
        { say: 'Now, about today. There’s a welcome talk at 11 in Lecture Hall A. Then you can choose between a campus tour and a workshop about the online learning platform. Which one are you going to do?',
          hints: { idea: 'Say your plan with “going to”, and give a reason.', starter: 'I think I’m going to…', example: 'I think I’m going to do the campus tour, because I don’t know the buildings yet.' } },
        { react: 'Good choice.', say: 'And this afternoon there’s the clubs fair. Are you interested in any extracurricular activities?',
          hints: { idea: 'Name a club or activity and why: I’m thinking of joining… / I used to…', starter: 'Yes, I’m thinking of joining…', example: 'Yes, I’m thinking of joining the debate club, because I want to improve my speaking.' } },
        { react: 'Oh, nice!', say: 'I’m in the debate club. We meet every Wednesday. Have you ever taken part in a debate?',
          hints: { idea: 'Answer with your experience (once, never…) and how it felt.', starter: 'Yes, once at…', example: 'Yes, once at high school. It was stressful but fun.' } },
        // Stage 5 · Closing
        { react: 'Great!', say: 'Do you have any other questions before the welcome talk?',
          hints: { idea: 'Thank Sara, or ask one last polite question.', starter: 'No, I think that’s everything…', example: 'Would you mind if I contacted you if I have more questions?' } },
        { react: 'Not at all.', say: 'I’ll be at the cafeteria at lunchtime, so come and say hi. Enjoy your first day!' },
      ],
    },
  },
  {
    id: 'professor', season: 1, level: 2, title: 'Meet the Professor', place: 'office', placeName: "Professor's office",
    time: 'Monday · 11:00', focus: 'Polite questions', summary: 'Introduce yourself to Prof. Benali.',
    setting: '', scene: [], roles: [], maxTurns: 3, playable: false,
  },
  {
    id: 'friends', season: 1, level: 3, title: 'Make Friends', place: 'cafe', placeName: 'Campus café',
    time: 'Monday · 13:00', focus: 'Keeping a conversation going', summary: 'Coffee with Sara and Yacine.',
    setting: '', scene: [], roles: [], maxTurns: 3, playable: false,
  },
  {
    id: 'team-project', season: 1, level: 4, title: 'Team Project', place: 'library', placeName: 'Library',
    time: 'Tuesday · 10:00', focus: 'Giving reasons',
    summary: 'Your team must build a tool for students in two weeks. Sara wants a web app. Yacine wants a mobile app.',
    setting:
      'The university library in Algeria. Three Computer Science students must choose how to build a tool for students in two weeks: a web app or a mobile app.',
    scene: [
      { who: 'sara', text: 'Okay, the brief is out. We have two weeks to build a tool for students.' },
      { who: 'yacine', text: "Two weeks? Easy. Let's make a mobile app. Everyone is on their phone all day." },
      { who: 'sara', text: 'A mobile app takes longer. We need to publish it in the store and test it on Android and iPhone.' },
      { who: 'yacine', text: "But students don't open websites anymore. They open apps." },
      { who: 'sara', text: 'A web app works on every device. The professor can test it from her laptop in one click.' },
      { who: 'yacine', text: "Hmm. And notifications? A website can't remind you about deadlines." },
      { who: 'sara', text: 'Okay. We need a third opinion. Let’s ask {name}.' },
      { who: 'yacine', text: 'Good idea. So, {name}… what do you think?' },
    ],
    roles: [
      {
        player: 'sara', partner: 'yacine',
        mission: 'Defend the web app. Convince Yacine.',
        goal: 'convince Yacine that a web app is better than a mobile app, giving at least two reasons',
        opening: 'So, {name}, you agree with Sara? Come on, everyone uses phones. Why a web app?',
        firstHints: {
          idea: 'Mention the two-week deadline, and that anyone can test it on any device.',
          starter: 'I think a web app is better because…',
          example: 'I think a web app is better because we only have two weeks, and everyone can test it on any device.',
        },
        demoReplies: [
          'Okay, but what about notifications? Apps can remind students about deadlines.',
          'Hmm, that’s fair. But will it look good on a small phone screen?',
          'Alright, you convinced me. Web app it is!',
        ],
      },
      {
        player: 'yacine', partner: 'sara',
        mission: 'Defend the mobile app. Convince Sara.',
        goal: 'convince Sara that a mobile app is better than a web app, giving at least two reasons',
        opening: 'So, {name}, you’re on Yacine’s side? A web app is faster to build. Why a mobile app?',
        firstHints: {
          idea: 'Talk about how students use their phones, and deadline reminders.',
          starter: 'I prefer a mobile app because…',
          example: 'I prefer a mobile app because students use their phones all day, and we can send deadline reminders.',
        },
        demoReplies: [
          'But publishing in the store takes time. How do we finish in two weeks?',
          'Okay… and what if the professor wants to test it on her laptop?',
          'Fine, you win. Let’s build the mobile app!',
        ],
      },
    ],
    maxTurns: 3,
    playable: true,
  },
  {
    id: 'deadline', season: 1, level: 5, title: 'Deadline Trouble', place: 'lab', placeName: 'Project lab',
    time: 'Thursday · 15:00', focus: 'Explaining a problem', summary: 'Prof. Haddad wants an update.',
    setting: '', scene: [], roles: [], maxTurns: 3, playable: false,
  },
  {
    id: 'presentation', season: 1, level: 6, title: 'Presentation Day', place: 'amphi', placeName: 'Amphitheatre',
    time: 'Sunday · 09:00', focus: 'Presenting and answering questions', summary: 'Both professors are watching.',
    setting: '', scene: [], roles: [], maxTurns: 3, playable: false,
  },
];

// Keep the teacher's order authoritative for both roles. Example student details are fictional.
const orientation = EPISODES.find((e) => e.id === 'orientation')!;
const studentGuide = orientation.guide!;
const topics = [
  ['registration', 'Check-in', 'Say whether already registered, or request registration here.'],
  ['identity', 'Check-in', 'Politely give a name and number, or explain the number is unknown.'],
  ['journey', 'Getting to know each other', 'Describe the journey here, including what happened or how long it took.'],
  ['university', 'Getting to know each other', 'Give a reason for choosing this university.'],
  ['living-away', 'Getting to know each other', 'Describe previous experience living away, or say this is the first time.'],
  ['student-card', 'Practical information', 'Ask a clarification about the student card, photo, deadline or location, or explicitly confirm understanding. A relevant question DOES satisfy this objective; answer it before advancing.'],
  ['concerns', 'Practical information', 'Explain a worry about starting university, or say there are no worries.'],
  ['study-preference', 'Practical information', 'Express a preference for studying alone or with others.'],
  ['study-spaces', 'Practical information', 'React to the study spaces or ask a practical follow-up question. A relevant question satisfies this objective; answer it before advancing.'],
  ['programme', "Today's programme", 'Choose the campus tour or platform workshop, ideally with a reason.'],
  ['clubs', "Today's programme", 'Describe an extracurricular interest, or say none.'],
  ['debate', "Today's programme", 'Describe debate experience or say never tried it.'],
  ['closing', 'Closing', 'Ask a final question, thank the helper, or politely say there are no more questions.'],
  ['farewell', 'Closing', 'Terminal farewell.'],
];
studentGuide.lines = studentGuide.lines.map((line, i) => ({ ...line, id: topics[i][0], stage: topics[i][1], criterion: topics[i][2], terminal: i === topics.length - 1 }));
const examples = [
  'I registered online last week.',
  'Sure, my name is Yacine Mansouri and my student number is 2026-0415.',
  'It was fine, but the bus was very crowded. It took me about an hour.',
  'I chose this university because it has a good reputation for computer science.',
  'No, never. This is the first time, so it is a big change.',
  'Sorry, did you say before Friday? Where is Student Services exactly?',
  'I am worried about making friends because I do not know anyone here.',
  'I prefer working alone because I can concentrate better. Is there a quiet place to study?',
  'That sounds useful. I will try the silent rooms.',
  'I think I am going to do the campus tour because I do not know the buildings yet.',
  'I am thinking of joining the debate club because I want to improve my speaking.',
  'Yes, once at high school. It was stressful but fun.',
  'No, I think that is everything. Thanks for your help!',
];
orientation.scene = studentGuide.lines.flatMap((line, i) => [
  { who: 'sara' as const, text: line.say },
  ...(examples[i] ? [{ who: 'yacine' as const, text: examples[i] }] : []),
]);
const helperObjectives = [
  ['Welcome the student and ask about registration.', 'Hi there, welcome…', studentGuide.lines[0].say],
  ['Ask for the student’s full name and number.', 'Could I have…', studentGuide.lines[1].say],
  ['Ask about their journey this morning.', 'How was…', studentGuide.lines[2].say],
  ['Ask why they chose this university.', 'Why did you…', studentGuide.lines[3].say],
  ['Ask whether they have lived away from family before.', 'Have you ever…', studentGuide.lines[4].say],
  ['Explain the welcome pack and the student card deadline.', 'Here is your…', studentGuide.lines[5].say],
  ['Answer the card-location/photo question, then ask about worries.', 'Student Services is…', studentGuide.lines[6].say],
  ['Reassure them and ask about study preferences.', 'That is normal. Do you prefer…', studentGuide.lines[7].say],
  ['Explain where to find silent and group study spaces.', 'The library has…', studentGuide.lines[8].say],
  ['Explain today’s programme and ask them to choose tour or workshop.', 'There is a welcome talk…', studentGuide.lines[9].say],
  ['Mention the clubs fair and ask about interests.', 'This afternoon…', studentGuide.lines[10].say],
  ['Mention the debate club’s Wednesday meetings and ask about debate experience.', 'We meet…', studentGuide.lines[11].say],
  ['Invite any final questions before the welcome talk.', 'Do you have…', studentGuide.lines[12].say],
  ['Close politely and explain that Sara is at the cafeteria at lunchtime.', 'I will be at…', studentGuide.lines[13].say],
];
const helperGuide: Guide = {
  mode: 'respond', partner: 'yacine', mission: 'Be Sara. Welcome the new student and explain the day.',
  goal: 'Guide a new student through check-in, practical information and today’s programme, in order.',
  facts: [...studentGuide.facts, 'The new student is Yacine Mansouri, student number 2026-0415, registered online last week.', 'Yacine took a crowded bus for an hour, chose computer science for its reputation, has never lived away and worries about making friends.', 'Yacine prefers studying alone, wants the campus tour and debate club, and debated once at school. These are fictional example student details.'],
  lines: helperObjectives.map(([criterion, starter, example], i) => ({
    id: topics[i][0], stage: topics[i][1], criterion, say: criterion,
    hints: { idea: criterion, starter, example },
  })),
};
orientation.roles = [
  { ...guideRole(studentGuide), player: 'yacine', guide: studentGuide },
  { ...guideRole(helperGuide), player: 'sara', firstSpeaker: 'learner', opening: '', guide: helperGuide },
];
orientation.setting = 'Orientation Day at a university in Algeria. Sara is the orientation helper; Yacine is the new student. The learner plays the selected role. Use only the configured campus facts.';
// An episode-level guide bypasses listening/role selection in the existing navigation.
delete orientation.guide;

/**
 * Lines can say {name}: the characters know the learner by name once they have met (from episode 2
 * on). Orientation Day, where the learner is new, simply doesn't use it.
 */
export function personalise(text: string, name: string | undefined) {
  return text.replace(/\{name\}/g, name?.trim() || 'friend');
}

export function getEpisode(id: string | undefined) {
  return EPISODES.find((e) => e.id === id);
}
