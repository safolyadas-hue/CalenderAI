import type { EventContext } from '../types/event';

/**
 * Preset 1: Traditional Indian Wedding
 * Large-scale outdoor wedding in a Tier-1 metro city.
 */
export const PRESET_WEDDING: EventContext = {
  id: 'preset-wedding-001',
  title: 'Ananya & Rohan\'s Royal Rajasthani Wedding',
  eventType: 'wedding',
  eventDate: '2027-02-14',
  guestCount: 500,
  totalBudget: 3500000,
  currency: 'INR',
  cityTier: 'tier1_metro',
  setting: 'outdoor',
  dietaryPreferences: ['vegetarian', 'Jain-friendly', 'no onion-garlic option'],
  culturalTheme: 'Royal Rajasthani with marigold & mirror work',
  customNotes: 'Three-day celebration: Mehndi, Sangeet, and main wedding day. Need separate mandap setup.',
};

/**
 * Preset 2: Kids' Birthday Party
 * Mid-size indoor birthday celebration in a Tier-2 city.
 */
export const PRESET_BIRTHDAY: EventContext = {
  id: 'preset-birthday-001',
  title: 'Little Arjun\'s Superhero 7th Birthday Bash',
  eventType: 'birthday',
  eventDate: '2027-01-15',
  guestCount: 40,
  totalBudget: 75000,
  currency: 'INR',
  cityTier: 'tier2_urban',
  setting: 'indoor',
  dietaryPreferences: ['egg-free', 'nut-free'],
  culturalTheme: 'Marvel Superheroes',
  customNotes: 'Kids ages 5-10 mostly. Need safe play area and nut-free zone for allergic children.',
};

/**
 * Preset 3: Community Fundraiser Gala
 * Large hybrid community event in a US metro city.
 */
export const PRESET_COMMUNITY: EventContext = {
  id: 'preset-community-001',
  title: 'Bay Area Tech for Good — Annual Fundraiser Gala',
  eventType: 'community',
  eventDate: '2027-03-22',
  guestCount: 300,
  totalBudget: 25000,
  currency: 'USD',
  cityTier: 'tier1_metro',
  setting: 'hybrid',
  dietaryPreferences: ['vegan options', 'gluten-free options', 'halal options'],
  culturalTheme: 'Innovation Meets Impact — Silicon Valley Green',
  customNotes: 'Keynote speaker + panel discussion + live auction. Need streaming setup for virtual attendees.',
};

/** All preset scenarios for quick testing */
export const ALL_PRESETS: { label: string; context: EventContext }[] = [
  { label: '💍 Royal Rajasthani Wedding (INR 35L, 500 guests)', context: PRESET_WEDDING },
  { label: '🎂 Superhero Birthday Bash (INR 75K, 40 guests)', context: PRESET_BIRTHDAY },
  { label: '🏘️ Tech for Good Fundraiser (USD 25K, 300 guests)', context: PRESET_COMMUNITY },
];
