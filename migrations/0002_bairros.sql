-- Bairro deixa de ser texto livre em cada imóvel e passa a ser uma linha
-- própria, referenciada por chave estrangeira.
--
-- Escrita à mão, e não gerada, porque o passo que importa fica NO MEIO: a
-- lista precisa nascer a partir dos bairros que já estão no acervo, senão o
-- backfill não teria para onde apontar e os endereços seriam perdidos.

CREATE TABLE `neighborhoods` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_neighborhoods_name` ON `neighborhoods` (`name`);
--> statement-breakpoint

-- Semeia a lista com o que o acervo já usa. `trim` evita que espaço sobrando
-- vire um bairro separado.
INSERT INTO `neighborhoods` (`name`)
SELECT DISTINCT trim(`address_neighborhood`)
FROM `properties`
WHERE `address_neighborhood` IS NOT NULL AND trim(`address_neighborhood`) <> '';
--> statement-breakpoint

ALTER TABLE `properties` ADD COLUMN `neighborhood_id` integer REFERENCES neighborhoods(id);
--> statement-breakpoint

UPDATE `properties`
SET `neighborhood_id` = (
  SELECT `id` FROM `neighborhoods` WHERE `name` = trim(`properties`.`address_neighborhood`)
);
--> statement-breakpoint

-- O índice antigo aponta para a coluna que vai embora, então sai primeiro.
DROP INDEX `idx_properties_neighborhood`;
--> statement-breakpoint
ALTER TABLE `properties` DROP COLUMN `address_neighborhood`;
--> statement-breakpoint
CREATE INDEX `idx_properties_neighborhood` ON `properties` (`neighborhood_id`);
