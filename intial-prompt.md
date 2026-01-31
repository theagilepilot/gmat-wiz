I want to build a gamified application to help me study for the GMAT. My target is an 800 and I have 0 GMAT experience. Its been a while since I've had to do any math too, I probably need to brush up on my math basics, grammar basics, reading comprehension, and the fundamentals of any other section - and then gradually be able to handle easy, medium, and hard questions at an expert level of performance. I want to be able to open the app, and be guided right towards what I should be working on to build muscles / gain XP to get to the next stage of GMAT readiness.

The app should help me train LIKE A MUSCLE the following skills
- Recognition - instantly classifying problem type
- Decision making - Choosing the fastest valid solution
- Execution - making zero algebra failures
- Area Fundamentals - Master the fundamentals of every area being tested so answers can be found quicker
- Timing discipline - Answering questions under pressure and moving on when time is out.

The app should also have an error log system, when mistakes are made, the user needs to reflect on whether it was a concept gap, recognition failure, decision error, execution error, or timing error (with descriptions for each). The error log should be smart and make sense for the type of question being asked.

The app should have some feedback loop / tracking system to identify what areas need to be focused on the most. So this can tie into the error log.

The app should also have a proper progression / skill tree. I should master the basics before moving to the easy questions, then easy questions before medium, then medium before hard.

The app should integrate with AI to generate GMAT questions, but also have a verification system to ensure they meet the proper criteria for an official-like GMAT question based on difficulty. The AI integration should use CpenAI API for now.

The gamification can also use some sort of ELO system that determines the difficulty of exposure. It should be optimized so if the user is clearly getting better, they start getting harder questions - like the real GMAT focus.

The app should be designed to be ran locally - NodeJS preferred. All user needs to do is input proper API keys in an .env file to get it working. Thus, appropriate data to save the users progress should be stored locally. 

Additionally, lets use a RAG system where the user can store any GMAT study documentation in a folder and have the AI model pull from it when generating questions. If nothing is supplied here though, just use normal AI generation..

Here is the level system and how it could work. Validate it for any gaps and add improvements if needed, again we need an 800 level test taker for someone who uses the app consistently for 4 months:

GMAT LEVEL SYSTEM (1 → 10)

Level 1 — Orientation: Understand GMAT structure, question types, scoring, and timing without solving for accuracy.

Level 2 — Foundations: Rebuild core math, grammar, and argument fundamentals until untimed solutions are clean and correct.

Level 3 — Recognition: Instantly identify question types and common traps before attempting to solve.

Level 4 — Easy Mastery: Answer easy questions quickly and accurately with zero careless errors.

Level 5 — Medium Control: Solve medium questions consistently using efficient methods and disciplined timing.

Level 6 — Strategy: Select the fastest valid approach, eliminate low-ROI paths, and guess strategically when needed.

Level 7 — Hard Exposure: Maintain correct process and composure on hard questions without chasing perfection.

Level 8 — Consistency: Produce stable, high-level performance across full sections under test conditions.

Level 9 — Elite Execution: Anticipate traps, manage timing instinctively, and score reliably in the 750–800 range.

Level 10 — Test-Day Operator: Execute calmly and mechanically on test day with no learning, only performance.

