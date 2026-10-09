// Site-wide settings

export const SITE = {
  title: 'sloraris',
  url: 'https://sloraris.dev',
  description:
    "I'm Parker (sloraris). I build and automate infrastructure, platforms, and networks, with a security mindset. Projects, write-ups, and sarcasm.",
  github: 'https://github.com/sloraris',
  linkedin: 'https://linkedin.com/in/parker-owings',
  email: 'sloraris@sloraris.dev',

  // null = built-in placeholder
  logo: '/logo.svg' as string | null,
  heroImage: '/cosmic-hero.webp' as string | null,

  // Shown in the nav pill's About button and in the author box at the end of every post, page and project.
  author: {
    name: 'sloraris',
    tagline: 'Infrastructure · Platforms · Processes',
    bio: 'I design infrastructure, platforms, and the processes around them. Security-trained, automation-minded, and fond of breaking things just to rebuild them better.',
    avatar: '/avatar.webp' as string | null, // 256x256 (the 5500px original is kept out of public/). null = gradient placeholder with the first letter
  },
};

export const NAV = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'posts', label: 'Posts', href: '/posts/' },
  { id: 'projects', label: 'Projects', href: '/projects/' },
  { id: 'about', label: 'About', href: '/about/' },
];
