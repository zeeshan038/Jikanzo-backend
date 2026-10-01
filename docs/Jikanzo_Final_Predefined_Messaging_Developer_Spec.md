# Jikanzo — Final Predefined Messaging Developer Specification

## Purpose

Build the Phase 1 Jikanzo booking-messaging UI as a **controlled predefined messaging system**.

This is **not unrestricted free-text chat**.

The system must allow both:

- **Client**
- **Companion**

to communicate using only approved Jikanzo messages and approved quick replies/actions.

The complete flow must work both ways:

**search → suggestions → select → send → receive → quick replies → reply / ignore and search another approved message**

---

# 1. Final Core Rule

## Search language can be flexible. Sent language is fixed.

The user may search using:

- contractions
- full-form wording
- shorthand
- informal typing
- abbreviations
- common spelling variations
- common typos
- intent phrases
- natural wording

But only the fixed approved Jikanzo message is sent.

Example:

```text
User searches:
i have reached

Suggestion:
I've reached.

Sent:
I've reached.
```

The raw user search text must never be sent.

---

# 2. Both Sides Work the Same Way

The predefined-message system must work identically for:

- Client
- Companion

Either side may:

1. search for an approved message
2. select and send it
3. receive contextual quick replies
4. choose a quick reply
5. ignore the quick replies
6. search for another approved question/message instead

Quick replies are **optional**, not compulsory.

---

# 3. Important Quick Reply Rule

When a user receives a message, contextual quick replies may appear.

Example:

```text
Client sends:
Where are you?

Companion sees:
- I'm at the meeting point.
- I'm at the entrance.
- I'm inside the venue.
- I'm outside the venue.
```

The Companion may:

### Option A — choose a quick reply

```text
I'm at the entrance.
```

OR

### Option B — ignore the quick replies

and search:

```text
have u reached
```

Then send:

```text
Have you reached?
```

The Client then receives that question and sees its own contextual quick replies.

This behavior must work in reverse too.

---

# 4. Searchable Content

The search box must search across:

1. Main approved predefined messages
2. Approved quick-reply answers

This means answers shown as quick-reply buttons must also be searchable manually.

Example:

```text
10 mints
10 min
10 mins
10 minutes
about 10
```

may return:

```text
About 10 minutes.
```

Other examples:

```text
np
```

may return:

```text
No problem.
```

```text
main entrance
```

may return:

```text
I'm at the main entrance.
```

```text
yes reached
```

may return:

```text
Yes, I've reached.
```

---

# 5. Main Messages Should Keep Search Priority

When both:

- a main approved message
- a contextual reply

match the same search intent equally well, the main approved message should receive a small ranking priority.

However, all approved replies remain searchable.

Maximum suggestions:

**4**

---

# 6. Prototype Layout

Desktop:

```text
LEFT SIDE                       RIGHT SIDE
---------------------------     ---------------------------
CLIENT VIEW                     COMPANION VIEW
Mobile-style panel              Mobile-style panel
```

Both sides should remain visible together on desktop.

Responsive/mobile fallback may stack the views vertically.

---

# 7. Booking Header

Use the same booking on both sides.

**Activity:** Coffee & Conversation  
**Date:** Tomorrow  
**Time:** 6:00 PM  
**Meeting Point:** Dubai Mall  
**Booking Status:** Confirmed

Client side:

- Other person: Alex
- Label: Booking Messages

Companion side:

- Other person: Client
- Label: Booking Messages

---

# 8. Privacy Notice

Show on both sides:

> For your privacy, only Jikanzo-approved messages can be sent.

---

# 9. Search Field

Placeholder:

**Search what you want to say...**

This is a **search field**, not a normal chat composer.

Do not provide a button that sends arbitrary typed text.

The raw search text must never create a chat bubble.

---

# 10. Search Normalization

Normalize search input using:

- lowercase
- trim spaces
- collapse repeated spaces
- ignore punctuation for matching
- normalize apostrophe variations
- contraction/full-form equivalence
- common shorthand
- common typo forms
- intent aliases

Examples:

```text
i'm / im / i am
i've / ive / i have
i'll / ill / i will
what's / whats / what is
can't / cant / cannot
you're / youre / you are
```

Additional shorthand examples:

```text
whr r u
where r u
have u reached
how much tym
send loc
which gate
stuck in traffic
coming now
```

---

# 11. Approved Main Message Library

## A. ON THE WAY

1. Are you on your way?
2. Have you left yet?
3. I'm on my way.
4. I'm leaving now.

## B. LATE / DELAY

1. Are you running late?
2. I'm running a little late.
3. How late will you be?
4. I may be a few minutes late.

## C. ETA / TIME

1. How long will you take?
2. What's your ETA?
3. When will you reach?
4. I'll be there shortly.

## D. REACHED / ARRIVED

1. Have you reached?
2. I've reached.
3. I'm almost there.
4. I'm nearby.

## E. LOCATION

1. Where are you?
2. Can you share your location?
3. I can't find you.
4. I can't find the meeting place.

## F. MEETING POINT

1. Are you at the meeting point?
2. I'm at the meeting point.
3. Can you come to the meeting point?
4. I'm coming to the meeting point.

## G. ENTRANCE / POSITION

1. Which entrance are you at?
2. I'm at the entrance.
3. I'm inside the venue.
4. I'm outside the venue.

## H. WAIT

1. Please wait for me.
2. Can you wait for a few minutes?
3. I'm waiting for you.
4. I'll be there shortly.

---

# 12. Important Intent Ranking Examples

## `whr r u`

1. Where are you?
2. Can you share your location?
3. I can't find you.
4. Are you at the meeting point?

## `i reached`

1. I've reached.
2. I'm at the meeting point.
3. I'm nearby.
4. I'm at the entrance.

## `have u reached`

1. Have you reached?
2. Are you at the meeting point?
3. I've reached.
4. I'm almost there.

## `stuck in traffic`

1. I'm running a little late.
2. I may be a few minutes late.
3. I'll be there shortly.

## `how much tym`

1. How long will you take?
2. What's your ETA?
3. When will you reach?
4. I'll be there shortly.

## `send loc`

1. Can you share your location?
2. Where are you?
3. I can't find the meeting place.
4. Are you at the meeting point?

## `which gate`

1. Which entrance are you at?
2. I'm at the entrance.
3. I'm inside the venue.
4. I'm outside the venue.

## `wait for me`

1. Please wait for me.
2. Can you wait for a few minutes?
3. I'm waiting for you.
4. I'll be there shortly.

## `coming now`

1. I'm on my way.
2. I'm leaving now.
3. I'll be there shortly.
4. I'm almost there.

## `are you late`

1. Are you running late?
2. How late will you be?
3. I'm running a little late.
4. I may be a few minutes late.

---

# 13. Contextual Quick Replies

## Received: Are you on your way?

- Yes, I'm on my way.
- I'm leaving now.
- I'm almost there.
- I may be a few minutes late.

## Received: Have you left yet?

- Yes, I've left.
- I'm leaving now.
- Not yet.
- I'll leave shortly.

## Received: I'm on my way.

- Okay, see you soon.
- I'm on my way too.
- I've already reached.

## Received: I'm leaving now.

- Okay, see you soon.
- I'm on my way too.
- Let me know when you're close.

## Received: Are you running late?

- Yes, a little.
- About 5 minutes.
- About 10 minutes.
- No, I'll be on time.

## Received: I'm running a little late.

- No problem.
- Okay, let me know when you're close.
- How long will you take?

## Received: How late will you be?

- About 5 minutes.
- About 10 minutes.
- About 15 minutes.
- I'm not sure yet.

## Received: I may be a few minutes late.

- No problem.
- Okay, let me know when you're close.
- I'll wait.

## Received: How long will you take?

- About 5 minutes.
- About 10 minutes.
- About 15 minutes.
- More than 15 minutes.

## Received: What's your ETA?

- About 5 minutes.
- About 10 minutes.
- About 15 minutes.
- More than 15 minutes.

## Received: When will you reach?

- In 5 minutes.
- In 10 minutes.
- In 15 minutes.
- I'll be there shortly.

## Received: I'll be there shortly.

- Okay.
- See you soon.
- I'll wait.

## Received: Have you reached?

- Yes, I've reached.
- I'm almost there.
- I'm nearby.
- Still on my way.

## Received: I've reached.

- I'm here too.
- I'm almost there.
- Coming now.
- Please wait for me.

## Received: I'm almost there.

- Okay.
- See you soon.
- I'll wait.

## Received: I'm nearby.

- Okay.
- See you soon.
- I'm waiting for you.

## Received: Where are you?

- I'm at the meeting point.
- I'm at the entrance.
- I'm inside the venue.
- I'm outside the venue.

## Received: Can you share your location?

- Share My Location
- Not now.

## Received: I can't find you.

- I'm at the meeting point.
- I'm at the entrance.
- Can you share your location?
- I'm looking for you too.

## Received: I can't find the meeting place.

- Can you share your location?
- Please check the meeting location.
- I'm at the meeting point.

## Received: Are you at the meeting point?

- Yes, I'm at the meeting point.
- I'm almost there.
- I'm at the entrance.
- Still on my way.

## Received: I'm at the meeting point.

- I'm coming there.
- I'm almost there.
- Please wait for me.

## Received: Can you come to the meeting point?

- Yes, I'm coming.
- Give me 5 minutes.
- I'm already there.

## Received: I'm coming to the meeting point.

- Okay.
- I'll wait.
- See you soon.

## Received: Which entrance are you at?

- I'm at the main entrance.
- I'm inside the venue.
- I'm outside the venue.
- Can you share your location?

## Received: I'm at the entrance.

- I'm coming there.
- I'm almost there.
- Please wait for me.

## Received: I'm inside the venue.

- Okay.
- I'm coming inside.
- Can you share your location?

## Received: I'm outside the venue.

- Okay.
- I'm coming outside.
- Can you share your location?

## Received: Please wait for me.

- Sure.
- No problem.
- Okay, I'll wait.

## Received: Can you wait for a few minutes?

- Sure.
- No problem.
- Okay, I'll wait.

## Received: I'm waiting for you.

- I'm almost there.
- I'm nearby.
- I'll be there shortly.
- Thank you.

---

# 14. Searchable Quick-Reply Examples

Quick-reply answers must also be searchable.

Examples:

```text
5 min
5 mins
5 minutes
5 mints
about 5
```

→ **About 5 minutes.**

```text
10 min
10 mins
10 minutes
10 mints
about 10
```

→ **About 10 minutes.**

```text
15 min
15 mins
15 minutes
15 mints
about 15
```

→ **About 15 minutes.**

```text
np
```

→ **No problem.**

```text
ok
```

→ **Okay.**

```text
thanks
thx
```

→ **Thank you.**

```text
main entrance
```

→ **I'm at the main entrance.**

```text
yes reached
```

→ **Yes, I've reached.**

---

# 15. Send / Receive Behaviour

When one side selects an approved suggestion:

1. Clear search input.
2. Hide suggestion list.
3. Add canonical approved message as sent bubble.
4. Add same message as received bubble on other side.
5. Scroll both conversation panels to latest.
6. Show contextual quick replies on receiver side if available.

Same behavior applies in both directions.

---

# 16. Quick Reply Behaviour

When a quick reply is selected:

1. Send immediately.
2. Show as sent on current side.
3. Show as received on opposite side.
4. Remove old quick replies.
5. If the new message has its own mapped quick replies, show those to the receiver.

If the receiver ignores quick replies and uses search instead:

- old quick replies may remain visible while searching
- once another approved message is sent, remove the old quick replies
- then show any new contextual quick replies generated by the newly received message

---

# 17. Location Sharing

Typing:

```text
location
send loc
share location
```

must never automatically share location.

It only suggests:

**Can you share your location?**

When received, show:

- Share My Location
- Not now.

If Share My Location is selected, show:

**Share your current location with this booking?**

Buttons:

- Share Location
- Cancel

Only after confirmation send:

**Location Shared**

Current location shared for this booking.

**View Location**

Prototype must not request real browser geolocation.

---

# 18. Session Start

Include:

**Simulate Session Start**

When clicked:

1. Show **Session Started**
2. Disable both search fields
3. Hide quick replies
4. Hide suggestions
5. Show:

**Booking Messages are unavailable after the session starts.**

6. Keep existing conversation visible

---

# 19. Reset Demo

Include:

**Reset Demo**

Reset must:

- clear conversation
- clear search input
- clear suggestions
- clear quick replies
- clear location cards
- restore search fields
- restore booking state

State:

**Booking Confirmed • Messaging Available Until Session Starts**

---

# 20. Demo Scenarios

## Scenario 1 — Where are you?

Client searches:

```text
whr r u
```

Client sends:

**Where are you?**

Companion sees replies:

- I'm at the meeting point.
- I'm at the entrance.
- I'm inside the venue.
- I'm outside the venue.

Companion may reply or ignore them and search another approved question/message.

---

## Scenario 2 — Running late

Companion searches:

```text
stuck in traffic
```

First result:

**I'm running a little late.**

Client sees:

- No problem.
- Okay, let me know when you're close.
- How long will you take?

---

## Scenario 3 — Location

Client searches:

```text
send loc
```

Sends:

**Can you share your location?**

Companion selects:

**Share My Location**

Then confirms:

**Share Location**

Location card is sent.

---

## Scenario 4 — Arrival

Client searches:

```text
have u reached
```

First result:

**Have you reached?**

Companion may choose:

**I'm almost there.**

or ignore it and search another approved question/message.

---

# 21. Technical Requirements

Prototype:

```text
index.html
```

Requirements:

- self-contained
- embedded CSS allowed
- embedded JavaScript allowed
- no backend
- no database
- no login
- no external API
- no real geolocation
- must work locally in browser
- desktop-first
- responsive fallback allowed

---

# 22. Recommended Data Model

Main approved message:

```js
{
  id: "reached_self",
  text: "I've reached.",
  aliases: [
    "ive reached",
    "i've reached",
    "i have reached",
    "i reached",
    "reached",
    "arrived"
  ],
  type: "main"
}
```

Quick reply:

```js
{
  id: "reply_about_10",
  text: "About 10 minutes.",
  aliases: [
    "10 min",
    "10 mins",
    "10 minutes",
    "10 mints",
    "about 10"
  ],
  type: "quick_reply"
}
```

Only `text` is sent.

Aliases are search-only.

---

# 23. Final Acceptance Rules

The implementation is correct only if:

- both Client and Companion can search and send
- both sides receive contextual quick replies
- both sides may ignore quick replies
- both sides may search another approved question/message instead
- all approved quick replies are searchable
- main messages remain slightly prioritized in equal matches
- raw user text is never sent
- only canonical approved wording is sent
- location requires explicit confirmation
- messaging closes at session start
- conversation history remains visible

---

# 24. Final Product Principle

The experience should feel like messaging, but technically remain a controlled predefined communication system.

**Flexible search. Fixed approved messages. Optional quick replies. Same behavior for both sides.**
