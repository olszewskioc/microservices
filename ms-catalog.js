const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const axios = require('axios');
const db = require('memory-cache');

const msCatalog = express();

axios.get('http://localhost:8090/api/produtos')
        .then(({ data: response }) => {
            if (response.err || !response.data) {
                console.error('Falha ao sincronizar dados!');
                
                return;
            }
            
            response.data.forEach((produto) => {
                db.put(produto.id, {
                    id: produto.id,
                    nome: produto.nome
                });
            });
            
            console.log('dados sincronizados com sucesso!!!');
        }).catch((error) => console.error(error));

msCatalog.use(express.json());
msCatalog.use(express.urlencoded({ extended: true}));

msCatalog.get('/api/catalog', (request, response) => {
    const data = JSON.parse(db.exportJson());
    
    response.status(data? 200 : 404);
    response.json(Object.values(data).map(item => item.value));
});

msCatalog.put('/api/catalog', (request, response) => {
    const schema = Joi.object({
       id: Joi.string().guid({ version: ['uuidv4'] }).required(),
       nome: Joi.string().max(255).required()
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
    
    db.put(produto.id, {
        id: produto.id,
        nome: produto.nome
    });
    
    response.status(201);
    response.json({
        data: produto,
        err: false
    });
});

msCatalog.listen(8091, () => console.log('ms-catalog online na porta: 8091'));
