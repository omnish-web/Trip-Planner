-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (Users)
create table profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TRIPS
create table trips (
  id uuid default uuid_generate_v4() primary key,
  created_by uuid references profiles(id) not null,
  title text not null,
  description text,
  start_date date,
  end_date date,
  header_image_url text,
  currency text default 'INR',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TRIP PARTICIPANTS
create table trip_participants (
  trip_id uuid references trips(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (trip_id, user_id)
);

-- EXPENSES
create table expenses (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references trips(id) on delete cascade not null,
  paid_by uuid references profiles(id) not null,
  title text not null,
  amount numeric(10, 2) not null,
  category text default 'General',
  date date default CURRENT_DATE,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- EXPENSE SPLITS
create table expense_splits (
  expense_id uuid references expenses(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  amount numeric(10, 2) not null,
  primary key (expense_id, user_id)
);

-- RLS POLICIES
alter table profiles enable row level security;
alter table trips enable row level security;
alter table trip_participants enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;

-- Profiles: Public read, self update
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- Trips: Viewable if participant
create policy "Trips viewable by participants." on trips for select using (
  auth.uid() in (select user_id from trip_participants where trip_id = id)
);
create policy "Trips insertable by auth users." on trips for insert with check (auth.role() = 'authenticated');
-- Trigger to add creator as participant
create or replace function public.handle_new_trip()
returns trigger as $$
begin
  insert into public.trip_participants (trip_id, user_id, role)
  values (new.id, auth.uid(), 'owner');
  return new;
end;
$$ language plpgsql security definer;
create trigger on_trip_created
  after insert on trips
  for each row execute procedure public.handle_new_trip();

-- Participants: Viewable by trip members
create policy "Participants viewable by trip members." on trip_participants for select using (
  trip_id in (select trip_id from trip_participants where user_id = auth.uid())
);

-- Expenses: Viewable by trip members
create policy "Expenses viewable by trip members." on expenses for select using (
  trip_id in (select trip_id from trip_participants where user_id = auth.uid())
);
create policy "Expenses insertable by trip members." on expenses for insert with check (
  trip_id in (select trip_id from trip_participants where user_id = auth.uid())
);

-- Splits: Viewable by trip members
create policy "Splits viewable by trip members." on expense_splits for select using (
  expense_id in (select id from expenses where trip_id in (
    select trip_id from trip_participants where user_id = auth.uid()
  ))
);

-- Helper to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
