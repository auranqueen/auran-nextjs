-- brand_points.track에 'REWARD'(일반 적립금) 허용. 월청구서 결제완료 웹훅 적립용
alter table brand_points drop constraint if exists brand_points_track_check;
alter table brand_points
  add constraint brand_points_track_check check (track = ANY (ARRAY['A', 'B', 'ARETE', 'REWARD']));
