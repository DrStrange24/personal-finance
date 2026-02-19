# Project Overview

This project is a personal finance web app built with Next.js (App Router) and TypeScript.

## Goals

- Provide a secure, reliable foundation for user authentication.
- Establish a clean structure for future finance features.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Sass (SCSS modules + global SCSS)
- PostgreSQL + Prisma

## Theming

- Global light/dark mode is supported across auth and app routes.
- Theme values are centralized as CSS variables so new features automatically stay theme-compatible when they use the shared tokens.

## Authentication

- Email and password login/signup.
- Passwords are hashed before storage.
- Sessions use a JWT stored in an HTTP-only cookie.
