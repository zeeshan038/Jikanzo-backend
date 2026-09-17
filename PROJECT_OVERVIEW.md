# Jikanzo - Project Overview

Welcome to the **Jikanzo** backend! This document provides a high-level overview of the backend architecture, technology stack, and core domain models to help frontend developers (especially for the admin panel) understand the system.

## 🌟 What is Jikanzo?
Jikanzo is a premium companion booking platform (similar to an elite version of Uber or Airbnb for personal companionship). 
- **Clients** use the app to discover and book companions for various activities (dinners, city tours, event companionship). 
- **Companions** use the app to offer their time, manage their schedules, accept bookings, and interact with their followers through a social feed.

## 🔄 The Core Application Flow
Understanding the standard lifecycle of a booking and user interaction is critical for building the admin panel:

1. **Onboarding & Discovery**:
   - Users sign up and specify their role (`CLIENT` or `COMPANION`).
   - Companions set up their profiles (hourly rates, radius, gallery, bio, schedule).
   - Clients browse the **Feed** to discover companions based on location, ratings, and active "Moments" (similar to Instagram stories).

2. **Booking Lifecycle**:
   - **Request**: A Client sends a booking request with a specific date, time, and location.
   - **Accept/Decline**: The Companion receives a push notification and decides to `ACCEPT` or `DECLINE`.
   - **Payment (Wallet)**: Once accepted, the Client pays for the session using their in-app Wallet (funded via Stripe). The booking status changes to `PAID`.
   - **Meetup & OTP**: The Client and Companion meet. To officially start/complete the session, the Client provides a secure 4-digit **OTP** to the Companion.
   - **Completion**: Once the OTP is entered, the session is `COMPLETED`, and the Companion's wallet is credited.
   
3. **Post-Booking**:
   - The Client leaves a **Review** and Rating.
   - The system recalculates the Companion's **Job Success Score (JSS)** and **Reliability Score** based on whether the booking was completed successfully or canceled.

4. **Social & Engagement ("Moments")**:
   - Companions can post "Moments" (temporary photos/videos).
   - Clients can view these Moments and send virtual gifts (Diamonds/Rings) which act as appreciations and boost the Companion's visibility in the feed.

## 🚀 Tech Stack

The Jikanzo backend is a modern Node.js application built with the following technologies:
- **Framework**: Node.js with [Express.js](https://expressjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) for static typing
- **Database**: PostgreSQL
- **ORM**: [Prisma](https://www.prisma.io/) (Data modeling and migrations)
- **API Documentation**: Swagger (OpenAPI 3.0)
- **Notifications**: Firebase Cloud Messaging (FCM)
- **Payments**: Stripe (via Wallet system)

## 📂 Project Structure

```
jikanzo-backend/
├── prisma/               # Prisma schema and seed data scripts
│   └── schema.prisma     # Database schema definitions
├── src/
│   ├── config/           # Environment and app configuration
│   ├── controllers/      # Route handlers (Business logic)
│   ├── middlewares/      # Express middlewares (Auth, Validation)
│   ├── routes/           # API route definitions
│   └── utils/            # Helper functions (Notifications, JSS calc)
├── swagger.json          # OpenAPI specifications
├── .env                  # Environment variables
└── package.json          # Project dependencies and scripts
```

## 🧠 Core Domain Models (Database Entities)

The platform connects **Clients** with **Companions**. Here are the primary entities:

### 1. User
The base identity for all accounts. A user can have a role of `CLIENT`, `COMPANION`, or `BOTH`. It stores core details like username, phone, wallet balance, gallery, and basic profile info.

### 2. CompanionProfile
An extension of the `User` model, specifically for companions. It holds professional details such as:
- `hourlyRate` & `serviceRadius`
- `trustRank`, `rating`, `jssScore`, and `reliabilityScore`
- Availability and Schedules (Weekly, One-Time, Blocked Dates)

### 3. Booking
Represents a scheduled session between a Client and a Companion.
- Manages states (`PENDING`, `ACCEPTED`, `COMPLETED`, `CANCELLED`)
- Stores time, location (lat/lng), and total amounts.
- Uses an **OTP** mechanism for session completion.

### 4. Review
Ratings and feedback given by Clients to Companions after a completed booking.

### 5. Moment & MomentView
A feature similar to Instagram Stories, where companions can upload expiring media (Moments) that Clients can view, like, and appreciate (Diamonds/Rings).

### 6. WalletTransaction
Tracks the flow of in-app currency. Clients deposit money into their wallet via Stripe to pay for bookings, and Companions earn money through their services.

## 🔗 API Documentation

The complete, detailed API specifications (including request bodies and response schemas) are documented in Swagger. 

You can find the generated Markdown version of all endpoints here:
**[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** 

*(Use this file to understand the exact JSON payloads you need to send and what responses to expect for the admin panel integration).*

## 🛠 Getting Started for Admin Panel Integration

1. **Authentication**: Most secure routes expect a Bearer token in the `Authorization` header. Admins will log in to receive an auth token.
2. **Endpoints**: Check `API_DOCUMENTATION.md` for specific admin-related routes (e.g., fetching all users, managing disputes, verifying companions, overriding trust ranks).
3. **Data Formatting**: Dates are transmitted in standard ISO 8601 strings (e.g., `2024-11-20T18:00:00.000Z`).

If you need any new endpoints or schema adjustments for the Admin dashboard, please refer to the backend team!
