---
sidebar_position: 1
---

# Introduction

**noCTF** is a modern, purpose-built Capture The Flag (CTF) platform designed to support events at
any scale — from small community events to large, international CTFs with thousands of participants.

Originally developed for and first deployed in [DownUnderCTF](https://downunderctf.com), the largest
CTF in the southern hemisphere, **noCTF** is engineered from day one with performance, scalability,
and usability in mind. It has since proven itself in production, successfully supporting over 5,000
players over 48 hours, with a peak load of over 200 TPS and sustained average of 100 TPS.

## Key Features
- **Scalable Architecture:** Built to handle CTFs large, small and in-between.
- **Minimal Dependencies:** Easy to deploy with only PostgreSQL, Redis, and NATS as core
requirements.
- **Event-Driven Backend:** Fast and efficient thanks to an event-based architecture for real-time
scoreboard calculations, notifications and more.
- **Role-Based Access Control:** Granular admin permissions allow secure delegation of
responsibilities.
- **Divisions Support:** Native support for multiple scoring brackets or competition tiers.
- **Advanced Audit Logging:** Detailed logs for administrative actions provide transparency and
accountability.
- **User-Friendly Interface:** Designed to be intuitive for organisers of all experience levels.
- **Authentication Options:** Supports both social login as well as being able to serve as an OIDC
provider, enabling seamless connectivity with auxiliary services like dynamic challenge instancing
or participation certificate generation.