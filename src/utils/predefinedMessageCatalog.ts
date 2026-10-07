import { normalizeSearchInput } from './predefinedMessageNormalize';

export type PredefinedMessageType = 'main' | 'quick_reply' | 'system';

export type PredefinedMessage = {
  id: string;
  text: string;
  type: PredefinedMessageType;
  aliases: string[];
};

export type BookingMessageKind =
  | 'MAIN'
  | 'QUICK_REPLY'
  | 'LOCATION_SHARED'
  | 'TEXT'
  | 'IMAGE';

function msg(
  id: string,
  text: string,
  type: PredefinedMessage['type'],
  aliases: string[] = []
): PredefinedMessage {
  const base = normalizeSearchInput(text);
  const aliasSet = new Set<string>([base, ...aliases.map(normalizeSearchInput)]);
  return { id, text, type, aliases: [...aliasSet].filter(Boolean) };
}

/** Main approved messages (§11) */
const MAIN: PredefinedMessage[] = [
  msg('on_way_ask', 'Are you on your way?', 'main', ['on your way', 'on the way', 'u on way']),
  msg('left_ask', 'Have you left yet?', 'main', ['have you left', 'did you leave']),
  msg('on_way_self', "I'm on my way.", 'main', ['im on my way', 'on my way', 'coming now', 'omw']),
  msg('leaving_now', "I'm leaving now.", 'main', ['leaving now', 'leave now']),
  msg('late_ask', 'Are you running late?', 'main', ['running late', 'are you late', 'u late']),
  msg('late_self', "I'm running a little late.", 'main', ['running late', 'stuck in traffic', 'little late']),
  msg('how_late', 'How late will you be?', 'main', ['how late']),
  msg('late_few', 'I may be a few minutes late.', 'main', ['few minutes late', 'minutes late']),
  msg('how_long', 'How long will you take?', 'main', ['how much tym', 'how long', 'how much time']),
  msg('whats_eta', "What's your ETA?", 'main', ['whats eta', 'your eta', 'eta']),
  msg('when_reach', 'When will you reach?', 'main', ['when reach', 'when will u reach']),
  msg('there_shortly', "I'll be there shortly.", 'main', ['there shortly', 'be there shortly']),
  msg('reached_ask', 'Have you reached?', 'main', ['have u reached', 'have you reached', 'u reached']),
  msg('reached_self', "I've reached.", 'main', ['ive reached', 'i reached', 'i have reached', 'reached', 'arrived']),
  msg('almost_there', "I'm almost there.", 'main', ['almost there']),
  msg('nearby', "I'm nearby.", 'main', ['nearby', 'im nearby']),
  msg('where_are_you', 'Where are you?', 'main', ['whr r u', 'where r u', 'where are u']),
  msg('share_location_ask', 'Can you share your location?', 'main', ['send loc', 'share location', 'share loc', 'location']),
  msg('cant_find_you', "I can't find you.", 'main', ['cant find you', 'cannot find you']),
  msg('cant_find_place', "I can't find the meeting place.", 'main', ['cant find meeting', 'cant find place']),
  msg('at_mp_ask', 'Are you at the meeting point?', 'main', ['at meeting point']),
  msg('at_mp_self', "I'm at the meeting point.", 'main', ['at the meeting point', 'meeting point']),
  msg('come_mp', 'Can you come to the meeting point?', 'main', ['come to meeting point']),
  msg('coming_mp', "I'm coming to the meeting point.", 'main', ['coming to meeting point']),
  msg('which_entrance', 'Which entrance are you at?', 'main', ['which gate', 'which entrance', 'what entrance']),
  msg('at_entrance', "I'm at the entrance.", 'main', ['at entrance', 'at the entrance']),
  msg('inside_venue', "I'm inside the venue.", 'main', ['inside venue', 'inside the venue']),
  msg('outside_venue', "I'm outside the venue.", 'main', ['outside venue', 'outside the venue']),
  msg('wait_me', 'Please wait for me.', 'main', ['wait for me']),
  msg('wait_few', 'Can you wait for a few minutes?', 'main', ['wait few minutes', 'wait a few']),
  msg('waiting_you', "I'm waiting for you.", 'main', ['waiting for you', 'im waiting']),
];

/** Quick replies & system (§13–§14) — searchable; only canonical text is sent */
const QUICK: PredefinedMessage[] = [
  msg('qr_yes_on_way', "Yes, I'm on my way.", 'quick_reply', ['yes on my way']),
  msg('qr_yes_left', "Yes, I've left.", 'quick_reply', ['yes left', 'yes ive left']),
  msg('qr_not_yet', 'Not yet.', 'quick_reply', ['not yet']),
  msg('qr_leave_shortly', "I'll leave shortly.", 'quick_reply', ['leave shortly']),
  msg('qr_ok_see_soon', 'Okay, see you soon.', 'quick_reply', ['see you soon', 'ok see you']),
  msg('qr_on_way_too', "I'm on my way too.", 'quick_reply', ['on my way too']),
  msg('qr_already_reached', "I've already reached.", 'quick_reply', ['already reached']),
  msg('qr_let_know_close', "Let me know when you're close.", 'quick_reply', ['when youre close']),
  msg('qr_yes_little', 'Yes, a little.', 'quick_reply', ['yes a little']),
  msg('qr_about_5', 'About 5 minutes.', 'quick_reply', ['5 min', '5 mins', '5 minutes', '5 mints', 'about 5', 'in 5 minutes']),
  msg('qr_about_10', 'About 10 minutes.', 'quick_reply', ['10 min', '10 mins', '10 minutes', '10 mints', 'about 10', 'in 10 minutes']),
  msg('qr_about_15', 'About 15 minutes.', 'quick_reply', ['15 min', '15 mins', '15 minutes', '15 mints', 'about 15', 'in 15 minutes']),
  msg('qr_on_time', "No, I'll be on time.", 'quick_reply', ['on time']),
  msg('qr_no_problem', 'No problem.', 'quick_reply', ['np', 'no prob']),
  msg('qr_not_sure_yet', "I'm not sure yet.", 'quick_reply', ['not sure yet']),
  msg('qr_ill_wait', "I'll wait.", 'quick_reply', ['ill wait']),
  msg('qr_more_15', 'More than 15 minutes.', 'quick_reply', ['more than 15']),
  msg('qr_okay', 'Okay.', 'quick_reply', ['ok']),
  msg('qr_see_you', 'See you soon.', 'quick_reply'),
  msg('qr_yes_reached', "Yes, I've reached.", 'quick_reply', ['yes reached']),
  msg('qr_still_on_way', 'Still on my way.', 'quick_reply', ['still on way']),
  msg('qr_here_too', "I'm here too.", 'quick_reply', ['here too']),
  msg('qr_coming_now', 'Coming now.', 'quick_reply', ['coming now']),
  msg('qr_waiting_for_you', "I'm waiting for you.", 'quick_reply'),
  msg('qr_share_my_location', 'Share My Location', 'quick_reply', ['share my location']),
  msg('qr_not_now', 'Not now.', 'quick_reply', ['not now']),
  msg('qr_looking_for_you', "I'm looking for you too.", 'quick_reply', ['looking for you']),
  msg('qr_check_meeting_location', 'Please check the meeting location.', 'quick_reply', ['check meeting location']),
  msg('qr_yes_at_mp', "Yes, I'm at the meeting point.", 'quick_reply', ['yes at meeting point']),
  msg('qr_coming_there', "I'm coming there.", 'quick_reply', ['coming there']),
  msg('qr_yes_coming', "Yes, I'm coming.", 'quick_reply', ['yes coming']),
  msg('qr_give_5', 'Give me 5 minutes.', 'quick_reply', ['give me 5']),
  msg('qr_already_there', "I'm already there.", 'quick_reply', ['already there']),
  msg('qr_main_entrance', "I'm at the main entrance.", 'quick_reply', ['main entrance']),
  msg('qr_coming_inside', "I'm coming inside.", 'quick_reply', ['coming inside']),
  msg('qr_coming_outside', "I'm coming outside.", 'quick_reply', ['coming outside']),
  msg('qr_sure', 'Sure.', 'quick_reply', ['sure']),
  msg('qr_thank_you', 'Thank you.', 'quick_reply', ['thanks', 'thx', 'thank u']),
  msg('location_shared', 'Location Shared', 'system', ['location shared']),
];

export const PREDEFINED_MESSAGES: PredefinedMessage[] = [...MAIN, ...QUICK];

export const MESSAGE_BY_ID: Map<string, PredefinedMessage> = new Map(
  PREDEFINED_MESSAGES.map((m) => [m.id, m])
);

/** Contextual quick replies keyed by received message id (§13) */
export const QUICK_REPLIES_BY_MESSAGE_ID: Record<string, string[]> = {
  on_way_ask: ['qr_yes_on_way', 'leaving_now', 'almost_there', 'late_few'],
  left_ask: ['qr_yes_left', 'leaving_now', 'qr_not_yet', 'qr_leave_shortly'],
  on_way_self: ['qr_ok_see_soon', 'qr_on_way_too', 'qr_already_reached'],
  leaving_now: ['qr_ok_see_soon', 'qr_on_way_too', 'qr_let_know_close'],
  late_ask: ['qr_yes_little', 'qr_about_5', 'qr_about_10', 'qr_on_time'],
  late_self: ['qr_no_problem', 'qr_let_know_close', 'how_long'],
  how_late: ['qr_about_5', 'qr_about_10', 'qr_about_15', 'qr_not_sure_yet'],
  late_few: ['qr_no_problem', 'qr_let_know_close', 'qr_ill_wait'],
  how_long: ['qr_about_5', 'qr_about_10', 'qr_about_15', 'qr_more_15'],
  whats_eta: ['qr_about_5', 'qr_about_10', 'qr_about_15', 'qr_more_15'],
  when_reach: ['qr_about_5', 'qr_about_10', 'qr_about_15', 'there_shortly'],
  there_shortly: ['qr_okay', 'qr_see_you', 'qr_ill_wait'],
  reached_ask: ['qr_yes_reached', 'almost_there', 'nearby', 'qr_still_on_way'],
  reached_self: ['qr_here_too', 'almost_there', 'qr_coming_now', 'wait_me'],
  almost_there: ['qr_okay', 'qr_see_you', 'qr_ill_wait'],
  nearby: ['qr_okay', 'qr_see_you', 'waiting_you'],
  where_are_you: ['at_mp_self', 'at_entrance', 'inside_venue', 'outside_venue'],
  share_location_ask: ['qr_share_my_location', 'qr_not_now'],
  cant_find_you: ['at_mp_self', 'at_entrance', 'share_location_ask', 'qr_looking_for_you'],
  cant_find_place: ['share_location_ask', 'qr_check_meeting_location', 'at_mp_self'],
  at_mp_ask: ['qr_yes_at_mp', 'almost_there', 'at_entrance', 'qr_still_on_way'],
  at_mp_self: ['qr_coming_there', 'almost_there', 'wait_me'],
  come_mp: ['qr_yes_coming', 'qr_give_5', 'qr_already_there'],
  coming_mp: ['qr_okay', 'qr_ill_wait', 'qr_see_you'],
  which_entrance: ['qr_main_entrance', 'inside_venue', 'outside_venue', 'share_location_ask'],
  at_entrance: ['qr_coming_there', 'almost_there', 'wait_me'],
  inside_venue: ['qr_okay', 'qr_coming_inside', 'share_location_ask'],
  outside_venue: ['qr_okay', 'qr_coming_outside', 'share_location_ask'],
  wait_me: ['qr_sure', 'qr_no_problem', 'qr_ill_wait'],
  wait_few: ['qr_sure', 'qr_no_problem', 'qr_ill_wait'],
  waiting_you: ['almost_there', 'nearby', 'there_shortly', 'qr_thank_you'],
};

export const CATALOG_VERSION = '1.0.0';
