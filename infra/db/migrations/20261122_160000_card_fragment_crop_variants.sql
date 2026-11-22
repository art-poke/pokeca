alter table public.card_fragment_images add column variant smallint not null default 0 check (variant >= 0);
alter table public.card_fragment_images drop constraint card_fragment_images_pkey;
alter table public.card_fragment_images add primary key (day, game, stage, slot, frame, variant);

alter table public.card_fragment_practice add column source_variant smallint not null default 0 check (source_variant >= 0);
