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
  guide?: Guide;             // guided episodes: no scene or sides, the learner talks as themselves
};

/**
 * A guided conversation, from the teacher's script. Each line is said by `who` (the guide's
 * partner unless set), after any `before` lines from other people in the scene; the learner then
 * answers it, and `criterion` is what that answer has to do to move on. The AI only writes a short
 * reaction to the real answer, said by whoever the learner was answering; `react` is the fallback
 * when there is no AI. The scripted lines are fixed, so they can be voiced in advance.
 */
export type GuideLine = {
  id?: string; stage?: string; criterion?: string; terminal?: boolean;
  who?: CastId; before?: { who: CastId; text: string }[];
  react?: string; say: string; hints?: Hints;
};
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

/** Who says a guided line. */
export const speakerOf = (g: Guide, line: GuideLine): CastId => line.who ?? g.partner;

/** Everything said for a guided line, in order: other people's `before` lines, then the line. */
export function lineParts(g: Guide, line: GuideLine): { who: CastId; text: string }[] {
  return [...(line.before ?? []), { who: speakerOf(g, line), text: line.say }];
}

/** Everyone who speaks in a guided episode, host first. */
export function guideCast(g: Guide): CastId[] {
  return Array.from(new Set([g.partner, ...g.lines.flatMap((l) => lineParts(g, l).map((p) => p.who))]));
}

/** Lines carry their stage forward (only the first line of a stage names it) and get an id. */
function staged(lines: GuideLine[]): GuideLine[] {
  let stage = '';
  return lines.map((l, i) => {
    stage = l.stage ?? stage;
    return { ...l, stage, id: l.id ?? `step-${i + 1}`, terminal: l.terminal ?? i === lines.length - 1 };
  });
}

// The four Season 1 scenarios were written by the team's English teacher ("Speakia B1 scenarios").
// The wording is theirs, with small changes so every line still works whatever the learner
// answered: a reaction to one particular answer ("Great!", "That's right.") moves into `react`
// (the AI writes the real reaction), and a fact that only answers the expected question moves
// into `facts` so the AI can say it when it is asked. Each change is noted next to its line.
export const EPISODES: Episode[] = [
  {
    id: 'orientation', season: 1, level: 1, title: 'Orientation Day', place: 'gate', placeName: 'Campus gate',
    time: 'Sunday · 08:30', focus: 'Talking about yourself and asking for information',
    summary: 'Your first day on campus. Sara welcomes you at the check-in desk and helps you get ready.',
    setting:
      'Orientation Day at a university in Algeria. Sara, a friendly student volunteer, is at the check-in desk welcoming new students. The learner is a new first-year student arriving for their first day.',
    scene: [], roles: [], maxTurns: 11, playable: true,
    guide: {
      partner: 'sara',
      mission: 'Check in for Orientation Day. Answer Sara’s questions and ask about anything that isn’t clear.',
      goal: 'check in, talk about yourself, and ask questions about the campus and the day',
      facts: [
        'The welcome pack has the timetable, a campus map and the student email login.',
        'The first class is tomorrow at 8:30 in Room B12. B12 is in the Languages building, next to the library.',
        'New students must activate their student email today, or they can’t see their timetable online. The IT desk on the first floor does it in two minutes.',
        'The welcome talk is at 10 in the amphitheatre. After that, students choose a campus tour or a library visit.',
        'There is a clubs fair at 2 this afternoon.',
        'The Academic Writing professor is friendly, but he’s strict about deadlines, so students should go to his office hours if they have questions.',
      ],
      lines: staged([
        { stage: 'Check-in', say: 'Hi, welcome to Orientation Day! Are you a new first-year student?',
          criterion: 'Say whether they are a new first-year student.',
          hints: { idea: 'Say yes, and that it’s your first day.', starter: 'Yes, I am. It’s my…', example: 'Yes, I am. It’s my first day today.' } },
        { react: 'Great!', say: 'Can I have your name and your department, please?',
          criterion: 'Give their name and their department or subject.',
          hints: { idea: 'Give your name, then your subject: I’m studying…', starter: 'Sure, my name is…', example: 'Sure, my name is Amina, and I’m studying computer science.' } },
        { stage: 'Getting to know each other', say: 'Nice to meet you! How did you get to campus this morning?',
          criterion: 'Say how they travelled to campus, in the past tense.',
          hints: { idea: 'Tell Sara what happened, in the past: I came… / It took…', starter: 'I came by…', example: 'I came by tram. It took about twenty minutes.' } },
        { say: 'And why did you choose your subject?',
          criterion: 'Give a reason for choosing their subject.',
          hints: { idea: 'Give a reason: I chose it because… / I want to become a…', starter: 'I chose it because…', example: 'I chose it because I’ve always loved computers.' } },
        { say: 'Are you living in the student residence or at home?',
          criterion: 'Say where they live (the residence or at home).',
          hints: { idea: 'Say where you live and add one detail.', starter: 'I’m staying in…', example: 'I’m staying in the residence, so it’s my first time away from home.' } },
        { stage: 'Practical information', say: 'Here’s your welcome pack: your timetable, a campus map and your email login. Your first class is tomorrow at 8:30 in Room B12.',
          criterion: 'Ask Sara to repeat or explain something (the room, the building or the time), or confirm they understood. A relevant question satisfies this.',
          hints: { idea: 'If something isn’t clear, ask Sara to repeat or explain.', starter: 'Sorry, did you say…', example: 'Sorry, did you say B12? Which building is that in?' } },
        { say: 'B12 is in the Languages building, next to the library. Oh, and you need to activate your student email today, or you can’t see your timetable online.',
          criterion: 'Ask how to activate the email or ask for help, or say they will do it.',
          hints: { idea: 'Ask how to do it, or ask for help.', starter: 'How do I…', example: 'How do I activate it? I’m not very good with computers.' } },
        { say: 'Just go to the IT desk on the first floor. They’ll do it in two minutes. So, how are you feeling about university so far?',
          criterion: 'Say how they feel about starting university.',
          hints: { idea: 'Say how you feel and why: I’m excited but… / I’m worried about…', starter: 'I’m excited but a bit nervous, because…', example: 'I’m excited but a bit nervous, because everything is new.' } },
        // "That's completely normal." is a reaction to a worry, so it is the fallback reaction.
        { stage: 'Today’s programme and clubs', react: 'That’s completely normal.',
          say: 'If I were you, I’d make a weekly plan from the start. The welcome talk is at 10 in the amphitheatre. After that, you can choose a campus tour or a library visit. Which one would you prefer?',
          criterion: 'Choose the campus tour or the library visit, ideally with a reason.',
          hints: { idea: 'Choose one and give a reason with “because”.', starter: 'I’d prefer the… because…', example: 'I’d prefer the campus tour, because I don’t know where anything is yet.' } },
        { react: 'Good idea.', say: 'There’s also a clubs fair at 2. What do you like doing in your free time?',
          criterion: 'Talk about a free-time activity or a club.',
          hints: { idea: 'Name a hobby. You can ask about a club too.', starter: 'I love… so maybe…', example: 'I love photography, so maybe the photography club.' } },
        { stage: 'Closing', say: 'Any more questions before the talk?',
          criterion: 'Ask a last question, or say there are no more questions and thank Sara.',
          hints: { idea: 'Ask one last question, or thank Sara.', starter: 'Yes, who…', example: 'Yes, who teaches Academic Writing?' } },
        // The teacher's answer about the Academic Writing professor is in `facts`: the AI says it
        // when the learner asks, and the line works for "No, that's everything" too.
        { say: 'Enjoy your first day!' },
      ]),
    },
  },
  {
    id: 'professor', season: 1, level: 2, title: 'Meeting the Professor', place: 'office', placeName: 'Professor’s office',
    time: 'Wednesday · 14:00', focus: 'Polite questions and asking for clarification',
    summary: 'You visit Prof. Benali in his office hours to ask about your first Academic Writing assignment.',
    setting:
      'Office hours at a university in Algeria. Prof. Benali teaches Academic Writing. The learner is a new student in his class who knocks on his office door to ask about the first assignment.',
    scene: [], roles: [], maxTurns: 11, playable: true,
    guide: {
      partner: 'benali',
      mission: 'Ask Prof. Benali about the assignment. Be polite, and ask when something isn’t clear.',
      goal: 'speak politely to a professor, explain being late, and ask about the assignment',
      facts: [
        'Prof. Benali teaches Academic Writing; this is his office hours.',
        'The learner arrived late to class on Monday.',
        'The first assignment: a paragraph of about 250 words describing a place that is important to the student, for example a hometown, a café or a grandmother’s house.',
        'The deadline is next Monday at midnight. It must be typed and sent by email.',
        'He offers to check the student’s plan before Friday; they can send it by email.',
        'His office hours are Tuesdays from 2 to 4.',
        'There will be a group project later this semester.',
      ],
      lines: staged([
        { stage: 'Arriving at office hours', say: 'Come in. Good afternoon. How can I help you?',
          criterion: 'Greet the professor politely and say why they came.',
          hints: { idea: 'Be polite and formal: Good afternoon… / Sorry to disturb you…', starter: 'Good afternoon, Professor. I’m…', example: 'Good afternoon, Professor. I’m in your Academic Writing class. Do you have a few minutes?' } },
        { react: 'Of course, have a seat.', say: 'You’re one of the new students, aren’t you? I think you arrived late on Monday.',
          criterion: 'Apologise or explain why they were late, in the past tense.',
          hints: { idea: 'Explain what happened, in the past: I was… / I couldn’t…', starter: 'Yes, I’m sorry about that. I…', example: 'Yes, I’m sorry about that. I got lost and couldn’t find Room B12.' } },
        { stage: 'The assignment', react: 'Don’t worry.', say: 'So, the first assignment is a paragraph of about 250 words describing a place that is important to you.',
          criterion: 'Ask a clarification question about the assignment, or confirm they understood. A relevant question satisfies this.',
          hints: { idea: 'If something isn’t clear, ask the professor to explain.', starter: 'Sorry, could you explain…', example: 'Sorry, could you explain what you mean by “a place that is important to me”?' } },
        { say: 'It can be anywhere: your hometown, a café, your grandmother’s house. The deadline is next Monday at midnight, and you send it by email.',
          criterion: 'Ask about the format or the deadline, or confirm they understood.',
          hints: { idea: 'Ask about the format or the deadline: Should I…? / Is it possible to…?', starter: 'Should I…', example: 'Should I write it by hand or type it?' } },
        // "Typed, please, and email is fine." answers one particular question, so it is in `facts`.
        { say: 'Have you already got an idea?',
          criterion: 'Share an idea for the paragraph, or say not yet and ask for an example.',
          hints: { idea: 'Say your idea and why, or ask for an example.', starter: 'I’m thinking of writing about…', example: 'I’m thinking of writing about the beach near my town, because I spent every summer there.' } },
        { stage: 'Talking about writing', say: 'Tell me, how do you feel about writing in English?',
          criterion: 'Say how they feel about writing in English.',
          hints: { idea: 'Be honest: I enjoy it, but… / To be honest, I find it…', starter: 'I enjoy it, but…', example: 'I enjoy it, but I make a lot of grammar mistakes.' } },
        { react: 'That’s very common.', say: 'What did you do at secondary school to practise writing?',
          criterion: 'Describe how they practised writing at school, in the past tense.',
          hints: { idea: 'Talk about the past: We wrote… / We mostly did…', starter: 'We wrote…', example: 'We wrote an essay every month, and the teacher corrected it.' } },
        { react: 'I see.', say: 'My advice is to write a short plan before you start. Would you like me to check your plan before Friday?',
          criterion: 'Accept or politely refuse the offer.',
          hints: { idea: 'Accept or refuse politely.', starter: 'Yes, please. That would be…', example: 'Yes, please. That would be really helpful. Can I send it by email?' } },
        { stage: 'An unexpected question', say: 'By the way, what would you like to do after your degree?',
          criterion: 'Talk about their future plans, for example with “I’d like to” or “I might”.',
          hints: { idea: 'Talk about the future: I’d like to… / I might…', starter: 'I’d like to…', example: 'I’d like to become a teacher, so writing is important for me.' } },
        { stage: 'Closing', react: 'Excellent.', say: 'Is there anything else?',
          criterion: 'Check a detail, ask a last question, or say there is nothing else.',
          hints: { idea: 'Check the deadline, ask one more question, or say that’s everything.', starter: 'No, that’s everything. So the deadline is…', example: 'No, that’s everything. So the deadline is Monday at midnight, right?' } },
        { react: 'That’s right.', say: 'My office hours are Tuesdays from 2 to 4. Oh, and there will be a group project later this semester, so get to know your classmates.',
          criterion: 'Thank the professor and say goodbye.',
          hints: { idea: 'Thank the professor and say goodbye politely.', starter: 'I will. Thank you…', example: 'I will. Thank you very much for your time, Professor. See you on Monday.' } },
        // Not in the script (it ends on the learner's goodbye): a short closing so the scene ends.
        { say: 'You’re welcome. See you on Monday.' },
      ]),
    },
  },
  {
    id: 'friends', season: 1, level: 3, title: 'Making Friends', place: 'cafe', placeName: 'Campus café',
    time: 'Wednesday · 16:00', focus: 'Keeping a conversation going',
    summary: 'After class, Rayan sits next to you in the café. Then Lina joins you.',
    setting:
      'The campus café at a university in Algeria, after the Academic Writing class. Rayan and Lina are classmates of the learner; they meet for the first time.',
    scene: [], roles: [], maxTurns: 12, playable: true,
    guide: {
      partner: 'rayan',
      mission: 'Get to know Rayan and Lina. Answer, ask follow-up questions and make a plan together.',
      goal: 'keep a friendly conversation going with two classmates and make a plan for the weekend',
      facts: [
        'Rayan, Lina and the learner are in the same Academic Writing class.',
        'Rayan loves photography. He has been taking photos for about three years; his uncle gave him his old camera. He is writing his paragraph about the sea, where he takes photos every weekend.',
        'Lina mostly reads and watches series. She loves mystery novels and has just finished one about a detective in Istanbul.',
        'Lina went to the old town last weekend. It has a market, and it is perfect for photos.',
        'The professor has just posted the group project: Rayan, Lina and the learner are in the same group. It is a five-minute presentation in two weeks.',
      ],
      lines: staged([
        { stage: 'Meeting Rayan', say: 'Hey, you’re in the Academic Writing class, aren’t you? I’m Rayan. Is this seat free?',
          criterion: 'Answer about the seat, and greet Rayan or introduce themselves.',
          hints: { idea: 'Say yes and introduce yourself.', starter: 'Yes, sure, sit down! I’m…', example: 'Yes, sure, sit down! I’m Amina. Nice to meet you.' } },
        { say: 'So, what did you think of the class?',
          criterion: 'Give an opinion about the class.',
          hints: { idea: 'Give your opinion and a reason: I liked it, but… / It seems…', starter: 'I liked it, but…', example: 'I liked it, but the assignment looks difficult.' } },
        { stage: 'Free time', say: 'Have you started the paragraph yet? I’m writing about the sea, because I take photos there every weekend.',
          criterion: 'Answer about the paragraph, or show interest with a follow-up question.',
          hints: { idea: 'Show interest and ask a follow-up question: Really? How long…?', starter: 'Not yet, but I’ve got an idea. How long…', example: 'Not yet, but I’ve got an idea. How long have you been into photography?' } },
        // "About three years. My uncle gave me his old camera." answers one particular question:
        // it is the fallback reaction and in `facts`.
        { react: 'About three years. My uncle gave me his old camera.', say: 'What about you? What do you do in your free time?',
          criterion: 'Talk about a free-time activity.',
          hints: { idea: 'Talk about your hobbies: I play… / I’m really into…', starter: 'I’m really into…', example: 'I play football with my friends on Fridays.' } },
        { stage: 'Meeting Lina', react: 'Cool!', before: [{ who: 'rayan', text: 'Oh, look, here’s Lina. Lina, come and sit with us!' }],
          who: 'lina', say: 'Hi! Sorry, am I interrupting?',
          criterion: 'Welcome Lina (for example: not at all, please join us).',
          hints: { idea: 'Welcome Lina and tell her what you’re talking about.', starter: 'Not at all! We’re talking about…', example: 'Not at all! We’re talking about hobbies. What do you like doing?' } },
        // "Mine are quite boring" became "My hobbies are…" so it also works if hobbies weren't mentioned.
        { who: 'lina', say: 'My hobbies are quite boring. I mostly read and watch series.',
          criterion: 'React and ask Lina a follow-up question (What kind…? / Which…?).',
          hints: { idea: 'Ask a “What kind…?” or “Which…?” question.', starter: 'That’s not boring! What kind of…', example: 'That’s not boring! What kind of books do you like?' } },
        { who: 'lina', say: 'I love mystery novels. I’ve just finished one about a detective in Istanbul. Do you read much?',
          criterion: 'Say whether they read much, with a detail.',
          hints: { idea: 'Answer and add a detail.', starter: 'Not really. I prefer…', example: 'Yes, I read in English sometimes, but it’s slow.' } },
        { stage: 'Experiences', who: 'lina', say: 'Have you ever been to the old town? I went last weekend and it was amazing.',
          criterion: 'Answer with the present perfect (I’ve been… / I’ve never been…), or ask what it is like.',
          hints: { idea: 'Have you ever…? → Yes, I’ve… / No, I’ve never…', starter: 'No, I’ve never been…', example: 'No, I’ve never been. What’s it like?' } },
        { say: 'It’s perfect for photos! And have you made many friends here yet?',
          criterion: 'Say whether they have made friends yet.',
          hints: { idea: 'Answer honestly: Not many, but… / Not really…', starter: 'Not many, but I met…', example: 'Not many, but I met Sara on Orientation Day.' } },
        { stage: 'Making plans', say: 'We should go somewhere together this weekend!',
          criterion: 'Make a suggestion (Why don’t we…? / How about…?).',
          hints: { idea: 'Make a suggestion: Why don’t we…? / How about …ing?', starter: 'Good idea! Why don’t we…', example: 'Good idea! Why don’t we go to the old town on Saturday?' } },
        { who: 'lina', say: 'Saturday works for me. What time should we meet, and where?',
          criterion: 'Suggest a time and a place to meet.',
          hints: { idea: 'Give a time and a place.', starter: 'Let’s meet at…', example: 'Let’s meet at the tram stop at ten.' } },
        { who: 'lina', say: 'Perfect! Oh, wait, my phone… The professor just posted the group project, and we three are in the same group!',
          criterion: 'React to the news, ideally with a question.',
          hints: { idea: 'React to the news and ask a question.', starter: 'That’s great news! When…', example: 'That’s great news! When is the deadline?' } },
        // Not in the script (it ends on the learner's question): a short closing so the scene ends.
        { who: 'lina', say: 'Let’s talk about it on Saturday. See you then!' },
      ]),
    },
  },
  {
    id: 'group-project', season: 1, level: 4, title: 'The Group Project', place: 'library', placeName: 'Library',
    time: 'Thursday · 10:00', focus: 'Suggesting, agreeing and disagreeing',
    summary: 'You, Rayan and Lina meet in the library to plan your first group presentation.',
    setting:
      'The university library in Algeria. The learner, Rayan and Lina are a group for an Academic Writing project: a five-minute presentation in two weeks.',
    scene: [], roles: [], maxTurns: 10, playable: true,
    guide: {
      partner: 'lina',
      mission: 'Plan the presentation with Rayan and Lina: suggest, agree, disagree politely and share the work.',
      goal: 'choose a topic, decide what to research, divide the tasks and solve a problem as a group',
      facts: [
        'The topic is “One way to improve student life on campus.” It is a five-minute presentation in two weeks.',
        'Rayan thinks the cafeteria is the bigger problem: the food is expensive and the queues are too long.',
        'The group needs three things: a survey, the research and the slides. Rayan does the research; Lina writes the introduction and the conclusion.',
        'Rayan has a football tournament this Saturday.',
        'The survey must be ready before Thursday.',
      ],
      lines: staged([
        { stage: 'Choosing a topic', say: 'Okay, the topic is “One way to improve student life on campus.” It’s a five-minute presentation in two weeks. Any ideas?',
          criterion: 'Suggest an idea to improve student life on campus, ideally with a reason.',
          hints: { idea: 'Make a suggestion: How about…? / I think we should… because…', starter: 'How about…', example: 'How about longer library opening hours? Lots of students need a quiet place to study.' } },
        { who: 'rayan', say: 'Hmm, I’m not sure. I think the cafeteria is a bigger problem. The food is expensive and the queues are too long.',
          criterion: 'Respond to Rayan: disagree politely or agree, with a reason.',
          hints: { idea: 'Disagree politely: I see your point, but…', starter: 'I see your point, but…', example: 'I see your point, but most students care more about studying.' } },
        { stage: 'Making a decision', say: 'Both ideas are good. Which one is easier to research in two weeks?',
          criterion: 'Choose one idea and give a reason.',
          hints: { idea: 'Choose one and say why, with “because”.', starter: 'The cafeteria, because…', example: 'The cafeteria, because we can ask students and see the queues ourselves.' } },
        { say: 'Okay, let’s go with that. How can we find out what other students think?',
          criterion: 'Suggest a way to find out what students think.',
          hints: { idea: 'Suggest a method: Why don’t we…? / We could…', starter: 'Why don’t we…', example: 'Why don’t we make a short online survey?' } },
        { stage: 'Dividing the tasks', say: 'Great. So we need three things: the survey, the research and the slides. Who wants to do what?',
          criterion: 'Offer to do one of the tasks.',
          hints: { idea: 'Offer to do something: I’ll… / I can take care of…', starter: 'I’ll do the…', example: 'I’ll do the slides, because I’m good at design.' } },
        { before: [{ who: 'rayan', text: 'Then I’ll do the research. Lina, can you write the introduction and the conclusion?' }],
          say: 'Sure. Is everyone happy with that?',
          criterion: 'Agree with the plan, or politely ask to change tasks.',
          hints: { idea: 'Agree, or politely ask to change.', starter: 'Yes, that sounds…', example: 'Actually, could I do the survey instead? I’ve made one before.' } },
        { stage: 'A problem', who: 'rayan', say: 'Oh no, I’ve just remembered I’ve got a football tournament this Saturday. I can’t do my part that day.',
          criterion: 'Offer Rayan a solution.',
          hints: { idea: 'Offer a solution: Don’t worry. Why don’t…? / We can swap…', starter: 'Don’t worry. Why don’t you…', example: 'Don’t worry. Why don’t you do it on Monday instead?' } },
        { react: 'Good idea.', say: 'But the survey must be ready before Thursday. Is that possible?',
          criterion: 'Say whether the survey can be ready before Thursday.',
          hints: { idea: 'Promise a day, or say it’s tight but you’ll try.', starter: 'Yes, I’ll send it to you on…', example: 'Yes, I’ll send it to you on Wednesday evening.' } },
        { stage: 'Closing', say: 'Okay, can someone summarise what we’ve decided?',
          criterion: 'Summarise the decisions: the topic and who does what.',
          hints: { idea: 'Summarise: So, we’ve decided to… / I’m going to…', starter: 'So, we’ve decided to…', example: 'So, we’ve decided to talk about the cafeteria. I’m doing the slides, Rayan is doing the research and Lina is writing the introduction.' } },
        { react: 'Perfect.', say: 'When shall we meet again?',
          criterion: 'Suggest when (and where) to meet again.',
          hints: { idea: 'Suggest a day, a time and a place.', starter: 'How about next…', example: 'How about next Tuesday after class, here in the library?' } },
        { who: 'rayan', say: 'Deal. See you then!' },
      ]),
    },
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

/**
 * Lines can say {name}: the characters know the learner by name once they have met.
 */
export function personalise(text: string, name: string | undefined) {
  return text.replace(/\{name\}/g, name?.trim() || 'friend');
}

export function getEpisode(id: string | undefined) {
  return EPISODES.find((e) => e.id === id);
}
