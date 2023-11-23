const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const axios = require('axios');

const msProduct = express();

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS produtos (
            id TEXT PRIMARY KEY,
            nome TEXT,
            preco REAL,
            quantidade INTEGER
        )`
    );

    const stmt = db.prepare("INSERT INTO produtos(id, nome, preco, quantidade) VALUES (?, ?, ?, ?)");
    
    stmt.run(uuidv4(), "Fonte Corsair 650W", 399.99, 40);
    stmt.run(uuidv4(), "Monitor Gamer Husky 700 27 LED", 999.99, 10);
    stmt.run(uuidv4(), "Gabinete Gamer XPG", 279.99, 400);
    stmt.finalize();
});

msProduct.use(express.json());
msProduct.use(express.urlencoded({ extended: true}));

msProduct.get('/api/produtos', (request, response) => {
   db.all("SELECT * FROM produtos", (err, produtos) => {
       if (err) {
            response.status(500);
            response.json({
                data: null,
                err: true
            });
            console.error(err);

            return;
        }

        response.status(produtos? 200 : 404);
        response.json({
            data: produtos? produtos : null,
            err: false
        });
   });
});

msProduct.get('/api/produtos/:id', (request, response) => {
   const stmt = db.prepare("SELECT * FROM produtos WHERE id = ?");
   
   stmt.get(request.params.id, (err, produto) => {
       if (err) {
            response.status(500);
            response.json({
                data: null,
                err: true
            });
            console.error(err);

            return;
        }
        
        response.status(produto? 200 : 404);
        response.json({
            data: produto? produto : null,
            err: false
        });
   });
});

msProduct.post('/api/produtos', (request, response) => {
   const stmt = db.prepare("INSERT INTO produtos(id, nome, preco, quantidade) VALUES (?, ?, ?, ?)");
   
   const schema = Joi.object({
       nome: Joi.string().max(255).required(),
       preco: Joi.number().min(0).required(),
       quantidade: Joi.number().integer().min(0).required()
   });
   
   const { value: produto, error } = schema.validate(request.body);
   
   if (error) {
        response.status(422);
        response.json({
            data: error,
            err: true
        });

        return;
    }
    
    produto.id = uuidv4();

   stmt.run([ produto.id, produto.nome, produto.preco, produto.quantidade ], (err) => {
       if (err) {
            response.status(500);
            response.json({
                data: null,
                err: true
            });
            console.error(err);

            return;
        }
        
        axios.put('http://localhost:8091/api/catalog', { id: produto.id, nome: produto.nome })
                .then(({ data: response }) => {
                    if (response.err || !response.data) {
                        console.error('Falha ao sincronizar dados!');

                        return;
                    }
                }).catch((e) => console.error(e));
        
        response.status(201);
        response.json({
            data: produto,
            err: false
        });
   });
});

msProduct.put('/api/produtos/:id', (request, response) => {
    const productId = request.params.id;

    const schema = Joi.object({
        nome: Joi.string().max(255).required(),
        preco: Joi.number().min(0).required(),
        quantidade: Joi.number().integer().min(0).required()
    });

    const { value: updatedProduct, error } = schema.validate(request.body);

    if (error) {
        response.status(422);
        response.json({
            data: error,
            err: true
        });

        return;
    }

    // Atualiza o produto no banco de dados
    const stmt = db.prepare(`
        UPDATE produtos
        SET nome = ?, preco = ?, quantidade = ?
        WHERE id = ?
    `);

    stmt.run([updatedProduct.nome, updatedProduct.preco, updatedProduct.quantidade, productId], (err) => {
        if (err) {
            response.status(500);
            response.json({
                data: null,
                err: true
            });
            console.error(err);

            return;
        }

        // Sincroniza os dados do produto alterado com o microsserviço de catálogo
        axios.put(`http://localhost:8091/api/catalog/${productId}`, { nome: updatedProduct.nome })
            .then(({ data: syncResponse }) => {
                if (syncResponse.err || !syncResponse.data) {
                    console.error('Falha ao sincronizar dados!');

                    return;
                }
            })
            .catch((e) => console.error(e));

        response.status(200);
        response.json({
            data: updatedProduct,
            err: false
        });
    });
});

msProduct.listen(8090, () => console.log('ms-produtos online na porta: 8090'));