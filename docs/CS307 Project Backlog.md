---
title: Team 26 - BoilerBridge Backlog
---
Logan Wilkinson, Xavion Marable, Emilio Guzman, Shreyansh Tehanguria, Shashank Mukkera, Vanessa Gomez Miselem

Problem Statement

A known issue for college students is finding group travel that correlates with their interests as well as their financial constraints. While there are other travel platforms like Expedia™ and TripAdvisor™, most of the existing platforms cater mostly to families or business travel. These platforms also do not have tools like group based travel options or budget management, which are super important for students that will have to travel on limited funds. With our travel planner, our users will be able to build itineraries, discover new destinations, and manage shared costs in one app, allowing students to focus on the experience of the trip instead of the stress of planning.

* * *

Background Information

Audience

Our primary target audience is university students as well as young adults who want to explore new places but are held back by the stress of coordinating group travel. These users are usually budget-conscious and need options that align more with their personal preferences without breaking the bank.

Similar Platforms

There are many other platforms in the travel industry, such as Expedia, TripAdvisor, Airbnb, and Splitwise. Expedia and TripAdvisor focus on bookings and reviews, Airbnb on finding a place to stay, and Splitwise for bill splitting between friends.

Limitations

The existing platforms mostly focus on families or business travel instead of the needs of students. They don’t have any tools for coordinating group travel, or anything related to budget management. BoilerBridge will address these limitations by creating an app that has LLM-powered itinerary generation with built in cost-splitting and group management, putting everything in one place.

* * *

Functional Requirements:

1.  As a user, I would like to be able to create an account.
2.  As a user, I would like to be able to login and manage my account settings.
3.  As a user, I would like to be able to edit my profile details, like name, school, location, and profile picture.
4.  As a user, I would like to be able to reset my password via email if I forget it.
5.  As a user, I would like to be able to create travel groups.
6.  As a user, I would like to be able to manage my travel group.
7.  As a user, I would like to be able to leave my travel group.
8.  As a user, I would like to be able to message the members of my travel group.
9.  As a user, I would like to be able to access a shared calendar for my travel group.
10.  As a user, I would like to be able to input my travel preferences.
11.   As a user, I would like to be able to write reviews for places I’ve visited.
12.   As a user, I would like to be able to see reviews for places people have travelled.
13.  As a user, I would like to create a budget for the trip.
14.  As a user, I would like to be able to post a shared cost to the group ledger.
15.  As a user, I would like to be able to view a list of what everyone owees at the end of the trip.
16.   As a user, I would like to be able to connect with new people by finding and adding them as friends.
17.   As a user, I would like to be able to create reminders for my travel.
18.   As a user, I would like to be able to create a shared photo album for trips.
19.   As a user, I would like to be able to establish a budget for the trip.
20.   As a user, I would like to be able to split the costs with my group.
21.   As a user, I would like to be able to generate alternative plans.
22.   As a user, I would like to be able to make changes to only one part of itinerary.
23.   As a user, I would like to be able to send text notifications to my group.
24.   As a user, I would like to be able to send email notifications to my group.
25.   As a user, I would like to be able to send in-app notifications to my group.
26.   As a user, I would like to be able to receive text notifications about my travel.
27.   As a user, I would like to be able to receive email notifications about my travel.
28.   As a user, I would like to be able to receive in-app notifications about my travel.
29.   As a user, I would like to be able to generate a random location based on budget.
30.   As a user, I would like to be able to click a button to regenerate specific options.
31.   As a user, I would like to be able to add activities/locations as must haves.
32.   As a user, I would like to be able to add activities/locations to avoid.
33.   As a user, I would like to be able to click a button to remove options.
34.   As a user, I would like to be able to retrieve previous itineraries.
35.   As a user, I would like to be able to post itineraries visible to all app users.
36.   As a user, I would like to be able to share itineraries via link.
37.   As a user, I would like to be able to export itineraries to my preferred calendar.
38.   As a user, I would like to be able to visit sites for more information about activities.
39.   As a user, I would like to be able to go to activity booking sites via external links.
40.   As a user, I would like to be able to see recommendations/extra info for activities.
41.   As a user, I would like to be able to see a summary of reviews for activities.
42.   As a user, I would like to be able to specify transportation preferences.
43.   As a user, I would like to be able to find temporary bag storage.
44.   As a user, I would like to be able to access an SOS button that shows emergency numbers.
45.   As a user, I would like to be able to have an offline map view.
46.   As a user, I would like to be able to have an offline itinerary view.
47.  As a user, I would like to be able to see a visual map representation of the itinerary.
48.  As a group leader, I would like to be able to remove specific people from the travel group.
49.  As a group leader, I would like to be able to transfer my leader's permission to another member.
50.  As a user, I would like to be able to reset my password by text message for faster access.
51.  As a user, I would like to be able to request payment from specific group members for a shared cost.
52.  As a user, I would like to be able to send a payment confirmation notice to a member after paying them back.
53.   As a user, I would like to be able to vote on specific activity options created by the itinerary generator.
54.   As a user, I would like to be able to share my real-time location with added friends.

Non-Functional Requirements:

Architecture and Performance

We are developing BoilerBridge as a web application using Next.js. With this framework, we will combine our frontend and backend into a single codebase, making it much easier to manage user accounts and itinerary updates in real time. We will use MongoDB as our NoSQL database to handle the relationships between users, groups, and itineraries. This architecture allows for efficient storage of scraped travel data, allowing the system to reuse some of that information for the future. To provide a high quality experience to our user, all group updates and messages should synchronize across all user devices in 500ms.

Security

Security is vital for BoilerBridge since it will handle user data and group transaction information. We will implement a secure login system with OAuth 2.0 to manage the user accounts. There will be roles and permission systems to make sure that users can only access the itineraries and messaging boards for the groups that they have joined. Any requests to the backend will be authenticated to prevent any unauthorized access or abuse of our service.

Usability

The interface should be easy to navigate so that the planning process is as stress free as possible. Since the platform has many tools like messaging, calendars, and expense tracking, the interface has to be well designed to make sure that students can coordinate quickly, and on all screen sizes. The goal is to have a central platform where all group members can see updates, like any wishlist items or itinerary changes, in the same place.

Deployment

Since our frontend and backend are integrated with Next.js, we can deploy our entire project as one unit. This makes it easier to test any new features like our cost-splitting logic or the AI itinerary generator. We will host the app in a Node.js environment that supports the real time collaboration our users need.

* * *
