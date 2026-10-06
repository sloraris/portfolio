// Site-wide settings

export const SITE = {
  title: 'sloraris',
  url: 'https://sloraris.dev',
  description:
    'Parker Owings (sloraris): self-hosted infrastructure, platforms, networking, and automation, all from a security background. Projects, write-ups, and a fair amount of sarcasm.',
  github: 'https://github.com/sloraris',
  linkedin: 'https://linkedin.com/in/parker-owings',
  email: 'sloraris@sloraris.dev',

  // null = built-in placeholder
  logo: '/logo.svg' as string | null,
  heroImage: '/cosmic-hero.webp' as string | null,
  // The one-liners that decode themselves on the home hero's first line, in random order. The first one is shown
  // before (and without) any script; a single entry just shows it. Keep them short (about 27 characters or fewer)
  // so they fit on one line on a phone.
  heroQuotes: [
    "It's working!",
    "It's always DNS.",
    "Don't panic.",
    'Stay on target.',
    'Make it so.',
    'Trust, but verify.',
    'Works on my machine.',
    "I'm in.",
    'Hello, world.',
    'Never tell me the odds.',
    'Turn it off and on again.',
    "'sudo' make me a sandwich.",
    'Resistance is futile.',
    'Uptime is a feature.',
    "I'm the world's best backwards driver!",
    "Those WERE the droids I was looking for...",
    "I'd smack ya if I had a hand.",
    "We have our heading.",
    "Why is the rum always gone?",
    "Float like a Cadillac, sting like a Beamer.",
    "You are being rescued. Please do not resist.",
  ] as string[],

  // Shown in the nav pill's About button and in the author box at the end of every post, page and project.
  author: {
    name: 'sloraris',
    tagline: 'Infrastructure, networking & security',
    bio: "I build and manage infrastructure that's clean, automated, and secure. Driven by curiosity, ruthless practicality, and a love of breaking things just to rebuild them better.",
    avatar: '/avatar.webp' as string | null, // 256x256 (the 5500px original is kept out of public/). null = gradient placeholder with the first letter
  },
};

export const NAV = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'posts', label: 'Posts', href: '/posts/' },
  { id: 'projects', label: 'Projects', href: '/projects/' },
  { id: 'about', label: 'About', href: '/about/' },
];
