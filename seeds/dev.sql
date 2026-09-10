-- ===========================================================================
-- Seed de DESENVOLVIMENTO. Dados fictícios, só para construir e ver o layout.
--
-- APAGA properties e users antes de inserir, então é re-executável — e por isso
-- NUNCA deve rodar contra o banco remoto. O script `npm run db:seed` é fixo em
-- --local justamente para isso.
--
-- Preços em centavos: R$ 450.000,00 = 45000000.
-- ===========================================================================

DELETE FROM property_images;
DELETE FROM properties;
DELETE FROM sessions;
DELETE FROM users;

-- O hash '!' é uma senha inutilizável (convenção). Login de verdade só na
-- Fase 4, que traz o script de criar admin com PBKDF2.
INSERT INTO users (id, name, email, password_hash, role, active) VALUES
  (1, 'Gestor CasaImobi', 'gestor@casaimobi.com.br', '!', 'admin', 1);

INSERT INTO properties
  (code, title, slug, description, price, type, category, status, is_condo,
   bedrooms, suites, bathrooms, parking_spaces, usable_area,
   address_street, address_number, hide_address_number, address_neighborhood, address_zip,
   development, created_by)
VALUES
  ('CI-0001',
   'Casa com 3 quartos e suíte no Maurício de Nassau',
   'casa-3-quartos-suite-mauricio-de-nassau',
   'Casa térrea em rua tranquila, próxima ao Colégio Diocesano. Sala ampla em dois ambientes, cozinha com armários planejados e quintal nos fundos.',
   45000000, 'house', 'residential', 'active', 0,
   3, 1, 2, 2, 180.0,
   'Rua Rádio Clube de Pernambuco', '212', 1, 'Maurício de Nassau', '55012-530',
   NULL, 1),

  ('CI-0002',
   'Apartamento 2 quartos no Centro',
   'apartamento-2-quartos-centro',
   'Apartamento reformado a duas quadras do Pátio do Forró. Prédio com elevador, portaria 24h e uma vaga coberta.',
   26500000, 'apartment', 'residential', 'active', 1,
   2, 0, 1, 1, 62.0,
   'Rua Duque de Caxias', '145', 0, 'Centro', '55010-040',
   'Edifício Solar do Agreste', 1),

  ('CI-0003',
   'Casa em condomínio fechado no Indianópolis',
   'casa-condominio-fechado-indianopolis',
   'Casa de alto padrão em condomínio com segurança 24h, piscina e quadra. Quatro quartos, sendo duas suítes, e área gourmet integrada ao quintal.',
   78000000, 'house', 'residential', 'active', 1,
   4, 2, 3, 3, 240.0,
   'Alameda das Palmeiras', '87', 1, 'Indianópolis', '55024-740',
   'Condomínio Portal do Agreste', 1),

  ('CI-0004',
   'Terreno 12x30 no Petrópolis',
   'terreno-12x30-petropolis',
   'Terreno plano e murado, 360 m², documentação em ordem e pronto para construir. Rua asfaltada com água e esgoto.',
   19000000, 'land', 'residential', 'active', 0,
   0, 0, 0, 0, 360.0,
   'Rua José Bezerra', 's/n', 0, 'Petrópolis', '55030-000',
   NULL, 1),

  ('CI-0005',
   'Sala comercial na Avenida Agamenon Magalhães',
   'sala-comercial-avenida-agamenon-magalhaes',
   'Sala de 45 m² em galeria com grande circulação, banheiro privativo e ar-condicionado instalado. Ideal para escritório ou consultório.',
   32000000, 'commercial', 'commercial', 'active', 0,
   0, 0, 1, 1, 45.0,
   'Avenida Agamenon Magalhães', '1020', 0, 'Maurício de Nassau', '55014-000',
   'Galeria Central', 1),

  ('CI-0006',
   'Apartamento 3 quartos no Universitário',
   'apartamento-3-quartos-universitario',
   'Apartamento próximo à UFPE Caruaru, com varanda, uma suíte e duas vagas. Condomínio com salão de festas e playground.',
   39500000, 'apartment', 'residential', 'active', 1,
   3, 1, 2, 2, 88.0,
   'Rua Professor José Nunes', '330', 0, 'Universitário', '55016-400',
   'Residencial Vila Nova', 1),

  ('CI-0007',
   'Casa 2 quartos na Cidade Alta (fora do ar)',
   'casa-2-quartos-cidade-alta',
   'Registro inativo de propósito: serve para conferir que imóvel inativo não aparece no site público.',
   21000000, 'house', 'residential', 'inactive', 0,
   2, 0, 1, 1, 95.0,
   'Rua Sete de Setembro', '58', 0, 'Cidade Alta', '55020-000',
   NULL, 1);
