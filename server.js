import express, { query, response } from "express";
import { configDotenv } from "dotenv";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";
import cors from "cors";

configDotenv.apply();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

//Initialize server
const app = express();
const port = 3001;
app.listen(port, () => {
  console.log("Server is running on port 3001...");
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

const corsOptions = {
    origin: "http://localhost:3000",
    credentials: true,
  };
  app.use(cors(corsOptions));

  app.get("/getAllparticipants", async (req, res) => {
    console.log("Fetching participants...");
    try {
      const [rows] = await db.query("SELECT * FROM applicants");
      res.json(rows)
    } catch (error) {
      console.error("Error fetching participants:", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/addParticipant", async (req, res) => {
    const participant = await req.body.newParticipant;
    const connection = await db.getConnection();
  
    try {
      // Start a transaction
      await connection.beginTransaction();
  
      // Insert into applicants table
      const [applicantResult] = await connection.query(
        `INSERT INTO applicants (first_name, last_name, final_status) 
         VALUES (?, ?, ?)`, 
        [participant.firstName, participant.lastName, participant.finalStatus]
      );
  
      const applicantId = applicantResult.insertId;
  
      // Insert into physical_tests table
      await connection.query(
        `INSERT INTO physical_tests (applicant_id, color_blind_test, far_sighted_test, astigmatism_test, reaction_test, is_passed) 
         VALUES (?, ?, ?, ?, ?, ?)`, 
        [
          applicantId,
          participant.testResults.physicalTest.colorBlindTest,
          participant.testResults.physicalTest.longSightednessTest,
          participant.testResults.physicalTest.astigmatismTest,
          participant.testResults.physicalTest.responseTest,
          participant.testResults.physicalTest.status
        ]
      );
  
      // Insert into theory_tests table
      await connection.query(
        `INSERT INTO theory_tests (applicant_id, traffic_signs_score, traffic_lines_score, right_of_way_score) 
         VALUES (?, ?, ?, ?)`, 
        [
          applicantId,
          participant.testResults.theoryTest.trafficSigns,
          participant.testResults.theoryTest.roadLines,
          participant.testResults.theoryTest.rightOfWay
        ]
      );
  
      // Insert into practical_tests table
      await connection.query(
        `INSERT INTO practical_tests (applicant_id, is_passed) 
         VALUES (?, ?)`, 
        [
          applicantId,
          participant.testResults.practicalTest.status
        ]
      );
  
      // Commit the transaction
      await connection.commit();
  
      // Send a success response
      res.status(200).json({ message: "Participant added successfully" });
  
    } catch (error) {
      // Rollback the transaction in case of an error
      await connection.rollback();
      console.error("Error adding participant:", error.message);
      res.status(500).json({ error: "Internal server error" });
    } finally {
      // Release the connection back to the pool
      connection.release();
    }
  });