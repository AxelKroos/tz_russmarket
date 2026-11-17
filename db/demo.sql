INSERT INTO employees (id, name, role, avatar) VALUES
    (1, 'Кузнецова Алина', 'агент', '/design/portrait-02.png'),
    (2, 'Волков Тимур', 'агент', '/design/portrait-03.png'),
    (3, 'Морозова Виктория', 'агент', '/design/portrait-04.png'),
    (4, 'Соколов Артём', 'агент', '/design/portrait-05.png'),
    (5, 'Лебедева Полина', 'агент', '/design/portrait-06.png'),
    (6, 'Новиков Кирилл', 'агент', '/design/portrait-07.png'),
    (7, 'Ерохина Дарья', 'агент', '/design/portrait-08.png'),
    (8, 'Гаврилов Егор', 'агент', '/design/portrait-09.png')
ON CONFLICT DO NOTHING;
