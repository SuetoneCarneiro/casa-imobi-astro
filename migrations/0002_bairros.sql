-- Bairro deixa de ser texto livre em cada imóvel e passa a ser uma linha
-- própria, referenciada por chave estrangeira.
--
-- O esqueleto foi gerado pelo drizzle, para o journal e o snapshot ficarem em
-- dia. Os dois passos de DADOS foram acrescentados à mão, porque o drizzle só
-- enxerga estrutura: sem eles o backfill não teria para onde apontar e todos os
-- endereços perderiam o bairro.

CREATE TABLE `neighborhoods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_neighborhoods_name` ON `neighborhoods` (`name`);--> statement-breakpoint

-- ACRESCENTADO À MÃO: semeia a lista com os bairros que o acervo já usa.
-- `trim` evita que espaço sobrando vire um bairro separado.
INSERT INTO `neighborhoods` (`name`)
SELECT DISTINCT trim(`address_neighborhood`)
FROM `properties`
WHERE `address_neighborhood` IS NOT NULL AND trim(`address_neighborhood`) <> '';--> statement-breakpoint
DROP INDEX `idx_properties_neighborhood`;--> statement-breakpoint
ALTER TABLE `properties` ADD `neighborhood_id` integer REFERENCES neighborhoods(id) ON DELETE RESTRICT;--> statement-breakpoint

-- ACRESCENTADO À MÃO: religa cada imóvel ao bairro recém-criado, pelo nome.
UPDATE `properties`
SET `neighborhood_id` = (
  SELECT `id` FROM `neighborhoods` WHERE `name` = trim(`properties`.`address_neighborhood`)
);--> statement-breakpoint
CREATE INDEX `idx_properties_neighborhood` ON `properties` (`neighborhood_id`);--> statement-breakpoint
ALTER TABLE `properties` DROP COLUMN `address_neighborhood`;