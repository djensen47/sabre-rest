Booking Management API v1.32 — Individual Operations
=====================================================
Source spec: docs/specifications/booking-management.yml
Base path:  /v1/trip/orders

Each line below is one operation that can be implemented as a standalone
add-api pass. Check off each operation as it is completed.

Booking
-------
[x] getBooking       POST /getBooking       — Retrieve comprehensive booking details by confirmation ID
[x] createBooking    POST /createBooking    — Create an air booking (NDC/ATPCO/LCC)
[x] modifyBooking    POST /modifyBooking    — Modify non-itinerary data in an existing booking
[x] cancelBooking    POST /cancelBooking    — Cancel a booking or specified items, optionally void/refund tickets

Flight Tickets
--------------
[x] fulfillTickets   POST /fulfillFlightTickets   — Fulfill flight tickets and EMDs
[x] voidTickets      POST /voidFlightTickets      — Void tickets by ticket number
[x] refundTickets    POST /refundFlightTickets    — Refund tickets and/or EMDs
[x] checkTickets     POST /checkFlightTickets     — Check tickets for void, refund, and exchange conditions
