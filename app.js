
const express = require("express");
const layouts = require("express-ejs-layouts");
const { body, validationResult } = require("express-validator");
const override = require("method-override");

const session = require("express-session");
const cookies = require("cookie-parser");
const flashMsg = require("connect-flash");

require("./utils/db");
const SiswaModel = require("./model/siswa");
const UserModel = require("./model/user");

const server = express();
const PORT = 3000;


server.use(override("_method"));
server.set("view engine", "ejs");
server.use(layouts);
server.use(express.static("public"));
server.use(express.urlencoded({ extended: true }));


server.use(cookies("mysecret"));
server.use(
  session({
    secret: "mysecret",
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 },
  })
);
server.use(flashMsg());


const mustLogin = (req, res, next) => {
  if (!req.session.uid) {
    req.flash("msg", "Anda harus login terlebih dahulu!");
    return res.redirect("/login");
  }
  next();
};


server.get("/login", (req, res) => {
  if (req.session.uid) return res.redirect("/");

  res.render("login", {
    title: "Login",
    layout: "layouts/main-layout",
    msg: req.flash("msg"),
  });
});

server.post(
  "/login",
  [
    body("username").notEmpty().withMessage("Username wajib diisi!"),
    body("password").notEmpty().withMessage("Password wajib diisi!"),
  ],
  async (req, res) => {
    const hasil = validationResult(req);

    if (!hasil.isEmpty()) {
      return res.render("login", {
        title: "Login",
        layout: "layouts/main-layout",
        errors: hasil.array(),
      });
    }

    try {
      const { username, password } = req.body;
      const akun = await UserModel.findOne({ username, password });

      if (!akun) {
        return res.render("login", {
          title: "Login",
          layout: "layouts/main-layout",
          errors: [{ msg: "Username atau password salah!" }],
        });
      }

      req.session.uid = akun._id;
      req.session.uname = akun.username;
      req.flash("msg", "Login berhasil!");

      return res.redirect("/");
    } catch (e) {
      console.log(e);
      return res.render("login", {
        title: "Login",
        layout: "layouts/main-layout",
        errors: [{ msg: "Kesalahan server!" }],
      });
    }
  }
);

// Logout
server.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});


server.get("/", mustLogin, async (req, res) => {
  const data = await SiswaModel.find();

  res.render("home", {
    title: "Home",
    layout: "layouts/main-layout",
    siswas: data,
    nama: req.session.uname || "Admin",
    msg: req.flash("msg"),
  });
});

// About
server.get("/about", (req, res) => {
  res.render("about", {
    title: "About",
    layout: "layouts/main-layout",
  });
});

// List siswa
server.get("/data-siswa", mustLogin, async (req, res) => {
  const list = await SiswaModel.find();

  res.render("data-siswa", {
    title: "Data Siswa",
    layout: "layouts/main-layout",
    siswas: list,
    msg: req.flash("msg"),
  });
});

// Form tambah
server.get("/data-siswa/add", mustLogin, (req, res) => {
  res.render("add-siswa", {
    title: "Tambah Siswa",
    layout: "layouts/main-layout",
  });
});

// Proses tambah
server.post(
  "/data-siswa",
  mustLogin,
  [
    body("nik")
      .isLength({ min: 16, max: 16 })
      .withMessage("NIK harus 16 digit!")
      .isNumeric()
      .withMessage("NIK hanya boleh angka!")
      .custom(async (v) => {
        const cek = await SiswaModel.findOne({ nik: v });
        if (cek) throw new Error("NIK sudah digunakan!");
        return true;
      }),
    body("nisn")
      .isLength({ min: 10, max: 10 })
      .withMessage("NISN harus 10 digit!")
      .isNumeric()
      .withMessage("NISN hanya boleh angka!")
      .custom(async (v) => {
        const cek = await SiswaModel.findOne({ nisn: v });
        if (cek) throw new Error("NISN sudah digunakan!");
        return true;
      }),
    body("tgl_masuk").custom((v) => {
      const input = new Date(v);
      const batas = new Date("2025-11-26");
      if (input > batas) throw new Error("Tanggal masuk lewat batas!");
      return true;
    }),
  ],
  async (req, res) => {
    const hasil = validationResult(req);
    if (!hasil.isEmpty()) {
      return res.render("add-siswa", {
        title: "Tambah Siswa",
        layout: "layouts/main-layout",
        errors: hasil.array(),
        siswa: req.body,
      });
    }

    await SiswaModel.insertMany(req.body);
    req.flash("msg", "Siswa berhasil ditambahkan!");
    res.redirect("/data-siswa");
  }
);

// Hapus siswa
server.delete("/data-siswa", mustLogin, async (req, res) => {
  await SiswaModel.deleteOne({ nisn: req.body.nisn });
  req.flash("msg", "Siswa berhasil dihapus!");
  res.redirect("/data-siswa");
});

// Form edit
server.get("/data-siswa/edit/:nisn", mustLogin, async (req, res) => {
  const cari = await SiswaModel.findOne({ nisn: req.params.nisn });

  res.render("edit-siswa", {
    title: "Edit Siswa",
    layout: "layouts/main-layout",
    siswa: cari,
  });
});

// Proses edit
server.put(
  "/data-siswa",
  mustLogin,
  [
    body("tgl_masuk")
      .notEmpty()
      .withMessage("Tanggal masuk wajib diisi!")
      .custom((v) => {
        const input = new Date(v);
        const batas = new Date("2025-11-26");
        if (input > batas)
          throw new Error("Tanggal masuk tidak boleh melebihi batas!");
        return true;
      }),
  ],
  async (req, res) => {
    const cek = validationResult(req);
    if (!cek.isEmpty()) {
      return res.render("edit-siswa", {
        title: "Edit Siswa",
        layout: "layouts/main-layout",
        errors: cek.array(),
        siswa: req.body,
      });
    }

    await SiswaModel.updateOne(
      { nisn: req.body.nisn },
      {
        $set: {
          tingkat: req.body.tingkat,
          rombel: req.body.rombel,
          tgl_masuk: req.body.tgl_masuk,
          terdaftar: req.body.terdaftar,
        },
      }
    );

    req.flash("msg", "Data siswa berhasil diupdate!");
    res.redirect("/data-siswa");
  }
);


server.listen(PORT, () =>
  console.log(`Server berjalan di http://localhost:${PORT}`)
);
